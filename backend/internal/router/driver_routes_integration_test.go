package router

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/config"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/testutil"
)

type driverAPI struct {
	t *testing.T
	r http.Handler
}

func (a driverAPI) call(method, path, token string, body any, want int) map[string]any {
	a.t.Helper()
	var payload []byte
	if body != nil {
		var err error
		payload, err = json.Marshal(body)
		if err != nil {
			a.t.Fatal(err)
		}
	}
	req := httptest.NewRequest(method, path, bytes.NewReader(payload))
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	response := httptest.NewRecorder()
	a.r.ServeHTTP(response, req)
	if response.Code != want {
		a.t.Fatalf("%s %s: status %d, want %d: %s", method, path, response.Code, want, response.Body.String())
	}
	if response.Body.Len() == 0 {
		return nil
	}
	var result map[string]any
	if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil {
		a.t.Fatal(err)
	}
	return result
}

func (a driverAPI) register(label string) map[string]any {
	a.t.Helper()
	name := label + uuid.NewString()[:12]
	return a.call("POST", "/api/v1/auth/register", "", map[string]any{
		"email": name + "@example.invalid", "username": name, "password": "Test-password-123!",
	}, http.StatusCreated)
}

func stringField(t *testing.T, data map[string]any, key string) string {
	t.Helper()
	value, ok := data[key].(string)
	if !ok || value == "" {
		t.Fatalf("missing %s in %#v", key, data)
	}
	return value
}

func TestDriverRoutesIntegration(t *testing.T) {
	db := testutil.OpenPostGIS(t)
	gin.SetMode(gin.TestMode)
	cfg := config.Load()
	cfg.Server.Env = "test"
	cfg.JWT.Secret = "driver-router-integration-test-secret"
	cfg.JWT.AccessExpiry = 15 * time.Minute
	cfg.JWT.RefreshExpiry = 24 * time.Hour
	cfg.Security.DefaultRequestsPerMinute = 1000
	cfg.Security.AuthRequestsPerMinute = 1000
	cfg.Security.ReportRequestsPerHour = 1000
	cfg.Security.AdminRequestsPerMinute = 1000
	api := driverAPI{t: t, r: Setup(db, cfg)}

	first := api.register("driver")
	second := api.register("peer")
	firstToken := stringField(t, first, "access_token")
	secondToken := stringField(t, second, "access_token")
	firstUser := first["user"].(map[string]any)
	secondUser := second["user"].(map[string]any)
	firstID := stringField(t, firstUser, "id")
	secondID := stringField(t, secondUser, "id")
	var sharedSessionID string
	t.Cleanup(func() {
		for _, id := range []string{firstID, secondID} {
			if _, err := db.Exec(`DELETE FROM users WHERE id = $1`, id); err != nil {
				t.Error(err)
			}
		}
	})

	t.Run("auth and preferences", func(t *testing.T) {
		api.call("GET", "/api/v1/profile", "", nil, http.StatusUnauthorized)
		api.call("GET", "/api/v1/profile", "invalid-token", nil, http.StatusUnauthorized)
		api.call("GET", "/api/v1/profile", firstToken, nil, http.StatusOK)
		api.call("POST", "/api/v1/auth/register", "", map[string]any{"email": firstUser["email"], "username": "different", "password": "Test-password-123!"}, http.StatusConflict)
		api.call("POST", "/api/v1/auth/register", "", map[string]any{"email": "invalid", "username": "x", "password": "short"}, http.StatusBadRequest)
		api.call("POST", "/api/v1/auth/refresh", "", map[string]any{"refresh_token": firstToken}, http.StatusUnauthorized)
		api.call("POST", "/api/v1/auth/login", "", map[string]any{"email": secondUser["email"], "password": "wrong-password"}, http.StatusUnauthorized)
		login := api.call("POST", "/api/v1/auth/login", "", map[string]any{"email": secondUser["email"], "password": "Test-password-123!"}, http.StatusOK)
		api.call("POST", "/api/v1/auth/logout", stringField(t, login, "access_token"), map[string]any{"refresh_token": stringField(t, login, "refresh_token")}, http.StatusNoContent)
		api.call("POST", "/api/v1/auth/refresh", "", map[string]any{"refresh_token": stringField(t, login, "refresh_token")}, http.StatusUnauthorized)
		api.call("PATCH", "/api/v1/profile/preferences", firstToken, map[string]any{"notification_radius_meters": 1501}, http.StatusBadRequest)
		api.call("PATCH", "/api/v1/profile/preferences", firstToken, map[string]any{}, http.StatusBadRequest)
		updated := api.call("PATCH", "/api/v1/profile/preferences", firstToken, map[string]any{
			"notification_radius_meters": 500, "notifications_enabled": false,
		}, http.StatusOK)
		if updated["notification_radius_meters"] != float64(500) || updated["notifications_enabled"] != false {
			t.Fatalf("preferences not saved: %#v", updated)
		}
		other := api.call("GET", "/api/v1/profile/preferences", secondToken, nil, http.StatusOK)
		if other["notification_radius_meters"] == float64(500) {
			t.Fatal("preferences leaked to another account")
		}
		api.call("GET", "/api/v1/admin/users", firstToken, nil, http.StatusForbidden)
		api.call("PATCH", "/api/v1/profile/push-token", firstToken, map[string]any{"push_token": "ExpoPushToken[router-test]"}, http.StatusNoContent)
		api.call("PATCH", "/api/v1/profile/push-token", firstToken, map[string]any{"push_token": string(make([]byte, 4097))}, http.StatusBadRequest)
		var devices int
		if err := db.Get(&devices, `SELECT COUNT(*) FROM user_devices WHERE user_id = $1 AND is_active = true`, firstID); err != nil {
			t.Fatal(err)
		}
		if devices != 1 {
			t.Fatalf("expected one registered push device, got %d", devices)
		}
		api.call("PATCH", "/api/v1/profile/push-token", firstToken, map[string]any{"push_token": nil}, http.StatusNoContent)
	})

	t.Run("parking lifecycle and shared feed", func(t *testing.T) {
		api.call("GET", "/api/v1/parking-sessions/active", firstToken, nil, http.StatusOK)
		api.call("POST", "/api/v1/parking-sessions", firstToken, map[string]any{"latitude": 91, "longitude": -79.387054}, http.StatusBadRequest)
		api.call("PATCH", "/api/v1/parking-sessions/not-a-uuid/end", firstToken, map[string]any{"share_open_spot": false}, http.StatusBadRequest)
		started := api.call("POST", "/api/v1/parking-sessions", firstToken, map[string]any{
			"latitude": 43.642567, "longitude": -79.387054, "address": "Test location",
		}, http.StatusCreated)
		sessionID := stringField(t, started, "id")
		sharedSessionID = sessionID
		t.Cleanup(func() {
			if _, err := db.Exec(`DELETE FROM alert_dispatch_jobs WHERE parking_session_id = $1`, sessionID); err != nil {
				t.Error(err)
			}
		})
		api.call("POST", "/api/v1/parking-sessions", firstToken, map[string]any{"latitude": 43.642567, "longitude": -79.387054}, http.StatusConflict)
		active := api.call("GET", "/api/v1/parking-sessions/active", firstToken, nil, http.StatusOK)
		if active["active"] != true {
			t.Fatalf("session not active: %#v", active)
		}
		api.call("PATCH", "/api/v1/parking-sessions/"+sessionID+"/end", secondToken, map[string]any{"share_open_spot": true}, http.StatusNotFound)
		ended := api.call("PATCH", "/api/v1/parking-sessions/"+sessionID+"/end", firstToken, map[string]any{"share_open_spot": true}, http.StatusOK)
		if ended["shared_open_spot"] != true || ended["open_spot"] == nil {
			t.Fatalf("spot not shared: %#v", ended)
		}
		spotID := stringField(t, ended["open_spot"].(map[string]any), "id")
		t.Cleanup(func() {
			if _, err := db.Exec(`DELETE FROM parking_spots WHERE id = $1`, spotID); err != nil {
				t.Error(err)
			}
		})
		feed := api.call("GET", "/api/v1/feed/nearby?latitude=43.642567&longitude=-79.387054&radius_meters=1000", secondToken, nil, http.StatusOK)
		spots := feed["parking_spots"].([]any)
		if len(spots) != 1 {
			t.Fatalf("shared spot absent: %#v", feed)
		}
		if spots[0].(map[string]any)["reporter_id"] != nil {
			t.Fatal("feed exposed reporter identity")
		}
		feedback := map[string]any{"saw_enforcement": false, "latitude": 43.642567, "longitude": -79.387054}
		api.call("POST", "/api/v1/parking-sessions/"+sessionID+"/feedback", firstToken, map[string]any{"latitude": 43.642567, "longitude": -79.387054}, http.StatusBadRequest)
		api.call("POST", "/api/v1/parking-sessions/"+sessionID+"/feedback", secondToken, feedback, http.StatusNotFound)
		api.call("POST", "/api/v1/parking-sessions/"+sessionID+"/feedback", firstToken, feedback, http.StatusOK)
		api.call("PATCH", "/api/v1/parking-spots/"+spotID+"/taken", firstToken, map[string]any{"latitude": 43.65, "longitude": -79.387054}, http.StatusNotFound)
		api.call("PATCH", "/api/v1/parking-spots/not-a-uuid/taken", firstToken, map[string]any{"latitude": 43.642567, "longitude": -79.387054}, http.StatusBadRequest)
		api.call("PATCH", "/api/v1/parking-spots/"+spotID+"/taken", firstToken, map[string]any{"latitude": 43.642567, "longitude": -79.387054}, http.StatusOK)
	})

	t.Run("unpark without sharing", func(t *testing.T) {
		started := api.call("POST", "/api/v1/parking-sessions", secondToken, map[string]any{"latitude": 43.71, "longitude": -79.40}, http.StatusCreated)
		id := stringField(t, started, "id")
		t.Cleanup(func() {
			if _, err := db.Exec(`DELETE FROM alert_dispatch_jobs WHERE parking_session_id = $1`, id); err != nil {
				t.Error(err)
			}
		})
		ended := api.call("PATCH", "/api/v1/parking-sessions/"+id+"/end", secondToken, map[string]any{"share_open_spot": false}, http.StatusOK)
		if ended["shared_open_spot"] != false || ended["open_spot"] != nil {
			t.Fatalf("non-shared session created a spot: %#v", ended)
		}
	})

	t.Run("enforcement and verification", func(t *testing.T) {
		bad := map[string]any{"latitude": 43.642567, "longitude": -79.387054, "accuracy_meters": 80, "enforcement_type": "chalking"}
		api.call("POST", "/api/v1/enforcement-alerts", secondToken, bad, http.StatusBadRequest)
		api.call("POST", "/api/v1/enforcement-alerts", secondToken, map[string]any{"latitude": 43.642567, "longitude": -79.387054, "enforcement_type": "unknown"}, http.StatusBadRequest)
		alert := api.call("POST", "/api/v1/enforcement-alerts", secondToken, map[string]any{
			"latitude": 43.642567, "longitude": -79.387054, "accuracy_meters": 5, "enforcement_type": "chalking",
		}, http.StatusCreated)
		alertID := stringField(t, alert, "id")
		t.Cleanup(func() {
			if _, err := db.Exec(`DELETE FROM alert_dispatch_jobs WHERE alert_id = $1`, alertID); err != nil {
				t.Error(err)
			}
			if _, err := db.Exec(`DELETE FROM verifications WHERE verifiable_id = $1`, alertID); err != nil {
				t.Error(err)
			}
			if _, err := db.Exec(`DELETE FROM enforcement_alerts WHERE id = $1`, alertID); err != nil {
				t.Error(err)
			}
		})
		url := "/api/v1/enforcement-alerts/" + alertID + "/verifications"
		api.call("POST", "/api/v1/enforcement-alerts/not-a-uuid/verifications", firstToken, map[string]any{"verification_type": "confirm", "latitude": 43.642567, "longitude": -79.387054}, http.StatusBadRequest)
		vote := map[string]any{"verification_type": "confirm", "latitude": 43.642567, "longitude": -79.387054}
		api.call("POST", url, secondToken, vote, http.StatusNotFound)
		api.call("POST", url, firstToken, map[string]any{"verification_type": "confirm"}, http.StatusBadRequest)
		api.call("POST", url, firstToken, map[string]any{"verification_type": "confirm", "latitude": 43.65, "longitude": -79.387054}, http.StatusNotFound)
		feedback := api.call("POST", "/api/v1/parking-sessions/"+sharedSessionID+"/feedback", firstToken, map[string]any{
			"saw_enforcement": true, "latitude": 43.642567, "longitude": -79.387054,
		}, http.StatusOK)
		if len(feedback["verified_alert_ids"].([]any)) != 1 {
			t.Fatalf("parking feedback did not confirm nearby enforcement: %#v", feedback)
		}
		confirmed := api.call("POST", url, firstToken, vote, http.StatusOK)
		if confirmed["confirmed_count"] != float64(1) {
			t.Fatalf("confirmation not saved: %#v", confirmed)
		}
		vote["verification_type"] = "deny"
		denied := api.call("POST", url, firstToken, vote, http.StatusOK)
		if denied["confirmed_count"] != float64(0) || denied["denied_count"] != float64(1) {
			t.Fatalf("vote not replaced: %#v", denied)
		}
		feed := api.call("GET", "/api/v1/feed/nearby?latitude=43.642567&longitude=-79.387054&radius_meters=1000", firstToken, nil, http.StatusOK)
		alerts := feed["enforcement_alerts"].([]any)
		if len(alerts) != 1 || alerts[0].(map[string]any)["reporter_id"] != nil {
			t.Fatalf("alert feed incorrect: %#v", feed)
		}
		api.call("GET", "/api/v1/feed/nearby?latitude=43.642567&longitude=-79.387054&radius_meters=1501", firstToken, nil, http.StatusBadRequest)
		api.call("PATCH", "/api/v1/enforcement-alerts/"+alertID+"/resolve", firstToken, nil, http.StatusNotFound)
		api.call("PATCH", "/api/v1/enforcement-alerts/"+alertID+"/resolve", secondToken, nil, http.StatusOK)
		api.call("PATCH", "/api/v1/enforcement-alerts/"+alertID+"/resolve", secondToken, nil, http.StatusNotFound)
		mergeTarget := api.call("POST", "/api/v1/enforcement-alerts", secondToken, map[string]any{
			"latitude": 43.642567, "longitude": -79.387054, "accuracy_meters": 5, "enforcement_type": "ticketing",
		}, http.StatusCreated)
		mergeID := stringField(t, mergeTarget, "id")
		t.Cleanup(func() {
			if _, err := db.Exec(`DELETE FROM alert_dispatch_jobs WHERE alert_id = $1`, mergeID); err != nil {
				t.Error(err)
			}
			if _, err := db.Exec(`DELETE FROM verifications WHERE verifiable_id = $1`, mergeID); err != nil {
				t.Error(err)
			}
			if _, err := db.Exec(`DELETE FROM enforcement_alerts WHERE id = $1`, mergeID); err != nil {
				t.Error(err)
			}
		})
		merged := api.call("POST", "/api/v1/enforcement-alerts", firstToken, map[string]any{
			"latitude": 43.642568, "longitude": -79.387054, "accuracy_meters": 5, "enforcement_type": "ticketing",
		}, http.StatusOK)
		if merged["merged"] != true || merged["alert"].(map[string]any)["id"] != mergeID {
			t.Fatalf("same-place report was not merged: %#v", merged)
		}
	})

	t.Run("notifications stay private", func(t *testing.T) {
		api.call("GET", "/api/v1/notifications?limit=0", firstToken, nil, http.StatusBadRequest)
		api.call("GET", "/api/v1/notifications?unread_only=perhaps", firstToken, nil, http.StatusBadRequest)
		var notificationID string
		if err := db.Get(&notificationID, `INSERT INTO notifications (user_id, title, body, notification_type)
			VALUES ($1, 'Test alert', 'A nearby report', 'enforcement_alert') RETURNING id`, firstID); err != nil {
			t.Fatal(err)
		}
		list := api.call("GET", "/api/v1/notifications?unread_only=true", firstToken, nil, http.StatusOK)
		if list["unread_count"] != float64(1) {
			t.Fatalf("notification absent: %#v", list)
		}
		other := api.call("GET", "/api/v1/notifications", secondToken, nil, http.StatusOK)
		if other["unread_count"] != float64(0) {
			t.Fatalf("notification leaked: %#v", other)
		}
		api.call("PATCH", fmt.Sprintf("/api/v1/notifications/%s/read", notificationID), secondToken, nil, http.StatusNotFound)
		api.call("PATCH", fmt.Sprintf("/api/v1/notifications/%s/read", notificationID), firstToken, nil, http.StatusOK)
		read := api.call("GET", "/api/v1/notifications?unread_only=true", firstToken, nil, http.StatusOK)
		if read["unread_count"] != float64(0) {
			t.Fatalf("notification still unread: %#v", read)
		}
		if _, err := db.Exec(`INSERT INTO notifications (user_id, title, body, notification_type) VALUES ($1, 'Second', 'Second report', 'enforcement_alert')`, firstID); err != nil {
			t.Fatal(err)
		}
		all := api.call("POST", "/api/v1/notifications/read-all", firstToken, nil, http.StatusOK)
		if all["marked_read"] != float64(1) {
			t.Fatalf("read-all changed the wrong rows: %#v", all)
		}
	})

	t.Run("refresh rotation rejects reuse", func(t *testing.T) {
		original := stringField(t, first, "refresh_token")
		rotated := api.call("POST", "/api/v1/auth/refresh", "", map[string]any{"refresh_token": original}, http.StatusOK)
		api.call("POST", "/api/v1/auth/refresh", "", map[string]any{"refresh_token": original}, http.StatusUnauthorized)
		api.call("POST", "/api/v1/auth/refresh", "", map[string]any{"refresh_token": stringField(t, rotated, "refresh_token")}, http.StatusUnauthorized)
	})
}
