package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/config"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/database"
)

// Set PARKOPTICON_TEST_DATABASE_URL to exercise the two API writes that must
// atomically create alert-dispatch jobs. The test uses its own UUIDs and only
// removes rows it created.
func TestAlertWritesCreateOutboxJobsIntegration(t *testing.T) {
	dsn := os.Getenv("PARKOPTICON_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("PARKOPTICON_TEST_DATABASE_URL is not configured")
	}

	db, err := sqlx.Connect("postgres", dsn)
	if err != nil {
		t.Fatalf("connect test database: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	if err := database.RunMigrations(db, config.DatabaseConfig{}); err != nil {
		t.Fatalf("apply migrations: %v", err)
	}

	userID := uuid.New()
	var alertID uuid.UUID
	username := "outbox" + userID.String()[:12]
	if _, err := db.Exec(`
		INSERT INTO users (id, email, password_hash, username)
		VALUES ($1, $2, 'not-used-by-test', $3)
	`, userID, username+"@example.com", username); err != nil {
		t.Fatalf("seed user: %v", err)
	}
	var notificationRadius int
	if err := db.Get(&notificationRadius, `SELECT notification_radius_meters FROM users WHERE id = $1`, userID); err != nil {
		t.Fatalf("load default notification radius: %v", err)
	}
	if notificationRadius != 1000 {
		t.Fatalf("unexpected notification radius default: got %d want 1000", notificationRadius)
	}
	if _, err := db.Exec(`UPDATE users SET notification_radius_meters = 2500 WHERE id = $1`, userID); err != nil {
		t.Fatalf("accept maximum notification radius: %v", err)
	}
	if _, err := db.Exec(`UPDATE users SET notification_radius_meters = 2501 WHERE id = $1`, userID); err == nil {
		t.Fatal("expected notification-radius constraint to reject 2501")
	}
	t.Cleanup(func() {
		if alertID != uuid.Nil {
			if _, err := db.Exec(`DELETE FROM enforcement_alerts WHERE id = $1`, alertID); err != nil {
				t.Errorf("clean up alert: %v", err)
			}
		}
		if _, err := db.Exec(`DELETE FROM users WHERE id = $1`, userID); err != nil {
			t.Errorf("clean up user: %v", err)
		}
	})

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_id", userID)
		c.Next()
	})
	enforcement := NewEnforcementHandler(db)
	parkingSessions := NewParkingSessionHandler(db)
	router.POST("/enforcement-alerts", enforcement.CreateEnforcementAlert)
	router.POST("/parking-sessions", parkingSessions.Create)

	latitude := 35.0 + float64(userID[0])/100
	longitude := -120.0 + float64(userID[1])/100
	alertBody := []byte(fmt.Sprintf(`{
		"latitude": %.6f,
		"longitude": %.6f,
		"enforcement_type": "ticketing",
		"severity": "high",
		"description": "Outbox integration report"
	}`, latitude, longitude))
	alertResponse := httptest.NewRecorder()
	router.ServeHTTP(alertResponse, httptest.NewRequest(http.MethodPost, "/enforcement-alerts", bytes.NewReader(alertBody)))
	if alertResponse.Code != http.StatusCreated {
		t.Fatalf("create enforcement alert: status=%d body=%s", alertResponse.Code, alertResponse.Body.String())
	}
	var alert struct {
		ID uuid.UUID `json:"id"`
	}
	if err := json.Unmarshal(alertResponse.Body.Bytes(), &alert); err != nil {
		t.Fatalf("decode enforcement alert: %v", err)
	}
	if alert.ID == uuid.Nil {
		t.Fatal("enforcement response did not include an alert id")
	}
	alertID = alert.ID
	var alertJobs int
	if err := db.Get(&alertJobs, `
		SELECT COUNT(*)
		FROM alert_dispatch_jobs
		WHERE event_type = 'enforcement_alert_created' AND alert_id = $1 AND status = 'pending'
	`, alert.ID); err != nil {
		t.Fatalf("load alert outbox job: %v", err)
	}
	if alertJobs != 1 {
		t.Fatalf("expected one pending alert job, got %d", alertJobs)
	}

	sessionBody := []byte(fmt.Sprintf(`{
		"latitude": %.6f,
		"longitude": %.6f,
		"address": "Outbox test location"
	}`, latitude+0.0001, longitude+0.0001))
	sessionResponse := httptest.NewRecorder()
	router.ServeHTTP(sessionResponse, httptest.NewRequest(http.MethodPost, "/parking-sessions", bytes.NewReader(sessionBody)))
	if sessionResponse.Code != http.StatusCreated {
		t.Fatalf("create parking session: status=%d body=%s", sessionResponse.Code, sessionResponse.Body.String())
	}
	var session struct {
		ID uuid.UUID `json:"id"`
	}
	if err := json.Unmarshal(sessionResponse.Body.Bytes(), &session); err != nil {
		t.Fatalf("decode parking session: %v", err)
	}
	if session.ID == uuid.Nil {
		t.Fatal("parking-session response did not include a session id")
	}
	var sessionJobs int
	if err := db.Get(&sessionJobs, `
		SELECT COUNT(*)
		FROM alert_dispatch_jobs
		WHERE event_type = 'parking_session_started' AND parking_session_id = $1 AND status = 'pending'
	`, session.ID); err != nil {
		t.Fatalf("load session outbox job: %v", err)
	}
	if sessionJobs != 1 {
		t.Fatalf("expected one pending session job, got %d", sessionJobs)
	}
}
