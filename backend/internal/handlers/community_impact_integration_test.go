package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/config"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/database"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/models"
)

// Set PARKOPTICON_TEST_DATABASE_URL to run this against a disposable PostGIS
// database. It verifies that the profile endpoint only exposes the caller's
// actual contribution events and does not invent a reputation score.
func TestCommunityImpactUsesRecordedEventsIntegration(t *testing.T) {
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

	authorID := uuid.New()
	reviewerID := uuid.New()
	recipientOneID := uuid.New()
	recipientTwoID := uuid.New()
	spotOneID := uuid.New()
	spotTwoID := uuid.New()
	otherSpotID := uuid.New()
	authorAlertID := uuid.New()
	otherAlertID := uuid.New()

	t.Cleanup(func() {
		for _, statement := range []struct {
			query string
			args  []any
		}{
			{
				`DELETE FROM notifications WHERE related_id IN ($1, $2)`,
				[]any{authorAlertID, otherAlertID},
			},
			{
				`DELETE FROM verifications WHERE verifiable_id IN ($1, $2, $3, $4, $5)`,
				[]any{spotOneID, spotTwoID, otherSpotID, authorAlertID, otherAlertID},
			},
			{
				`DELETE FROM parking_spots WHERE id IN ($1, $2, $3)`,
				[]any{spotOneID, spotTwoID, otherSpotID},
			},
			{
				`DELETE FROM enforcement_alerts WHERE id IN ($1, $2)`,
				[]any{authorAlertID, otherAlertID},
			},
			{
				`DELETE FROM users WHERE id IN ($1, $2, $3, $4)`,
				[]any{authorID, reviewerID, recipientOneID, recipientTwoID},
			},
		} {
			if _, err := db.Exec(statement.query, statement.args...); err != nil {
				t.Errorf("clean up community-impact fixture: %v", err)
			}
		}
	})

	for index, userID := range []uuid.UUID{authorID, reviewerID, recipientOneID, recipientTwoID} {
		username := fmt.Sprintf("impact%d%s", index, userID.String()[:8])
		if _, err := db.Exec(`
			INSERT INTO users (id, email, password_hash, username)
			VALUES ($1, $2, 'not-used-by-test', $3)
		`, userID, username+"@example.com", username); err != nil {
			t.Fatalf("seed user %d: %v", index, err)
		}
	}

	insertSpot := func(id, reporterID uuid.UUID, longitude, latitude float64) {
		t.Helper()
		if _, err := db.Exec(`
			INSERT INTO parking_spots (id, reporter_id, location, latitude, longitude)
			VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, $4, $3)
		`, id, reporterID, longitude, latitude); err != nil {
			t.Fatalf("seed parking spot: %v", err)
		}
	}
	insertSpot(spotOneID, authorID, -122.4194, 37.7749)
	insertSpot(spotTwoID, authorID, -122.4184, 37.7759)
	insertSpot(otherSpotID, reviewerID, -122.4174, 37.7769)

	insertAlert := func(id, reporterID uuid.UUID, longitude, latitude float64) {
		t.Helper()
		if _, err := db.Exec(`
			INSERT INTO enforcement_alerts (
				id, reporter_id, location, latitude, longitude,
				enforcement_type, description, severity, expires_at
			)
			VALUES (
				$1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, $4, $3,
				'ticketing', 'Community impact fixture', 'medium', $5
			)
		`, id, reporterID, longitude, latitude, time.Now().UTC().Add(time.Hour)); err != nil {
			t.Fatalf("seed enforcement alert: %v", err)
		}
	}
	insertAlert(authorAlertID, authorID, -122.4164, 37.7779)
	insertAlert(otherAlertID, reviewerID, -122.4154, 37.7789)

	for _, verification := range []struct {
		userID     uuid.UUID
		targetType string
		targetID   uuid.UUID
		kind       string
	}{
		{reviewerID, "parking_spot", spotOneID, "confirm"},
		{reviewerID, "enforcement_alert", authorAlertID, "confirm"},
		{authorID, "parking_spot", otherSpotID, "confirm"},
		{authorID, "enforcement_alert", otherAlertID, "deny"},
	} {
		if _, err := db.Exec(`
			INSERT INTO verifications (user_id, verifiable_type, verifiable_id, verification_type)
			VALUES ($1, $2, $3, $4)
		`, verification.userID, verification.targetType, verification.targetID, verification.kind); err != nil {
			t.Fatalf("seed verification: %v", err)
		}
	}

	for _, recipientID := range []uuid.UUID{recipientOneID, recipientTwoID, authorID} {
		if _, err := db.Exec(`
			INSERT INTO notifications (user_id, title, body, notification_type, related_type, related_id)
			VALUES ($1, 'Test alert', 'Community impact fixture', 'enforcement_alert', 'enforcement_alert', $2)
		`, recipientID, authorAlertID); err != nil {
			t.Fatalf("seed notification: %v", err)
		}
	}
	if _, err := db.Exec(`
		INSERT INTO notifications (user_id, title, body, notification_type, related_type, related_id)
		VALUES ($1, 'Other alert', 'Community impact fixture', 'enforcement_alert', 'enforcement_alert', $2)
	`, recipientOneID, otherAlertID); err != nil {
		t.Fatalf("seed unrelated notification: %v", err)
	}

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_id", authorID)
		c.Next()
	})
	router.GET("/profile/community-impact", NewAuthHandler(db, &config.Config{}).GetCommunityImpact)

	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/profile/community-impact", nil))
	if response.Code != http.StatusOK {
		t.Fatalf("get community impact: status=%d body=%s", response.Code, response.Body.String())
	}

	var impact models.CommunityImpact
	if err := json.Unmarshal(response.Body.Bytes(), &impact); err != nil {
		t.Fatalf("decode community impact: %v", err)
	}
	if impact.ReportsShared != 3 || impact.OpenSpotsShared != 2 || impact.EnforcementAlertsReported != 1 {
		t.Fatalf("unexpected authored report counts: %#v", impact)
	}
	if impact.ReportsConfirmed != 2 {
		t.Fatalf("unexpected reports confirmed: got %d want 2", impact.ReportsConfirmed)
	}
	if impact.ReportsChecked != 2 || impact.ConfirmationsGiven != 1 || impact.CorrectionsGiven != 1 {
		t.Fatalf("unexpected report-checking counts: %#v", impact)
	}
	if impact.DriversAlerted != 2 {
		t.Fatalf("unexpected drivers alerted: got %d want 2", impact.DriversAlerted)
	}
}
