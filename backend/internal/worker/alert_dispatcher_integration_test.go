package worker

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/config"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/database"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/notifications"
)

type recordingPushSender struct {
	messages []notifications.Message
	err      error
}

func (s *recordingPushSender) SendBatch(_ context.Context, messages []notifications.Message) ([]notifications.SendResult, error) {
	if s.err != nil {
		return nil, s.err
	}
	s.messages = append(s.messages, messages...)
	results := make([]notifications.SendResult, len(messages))
	for index := range messages {
		results[index].TicketID = fmt.Sprintf("ticket-%d", len(s.messages)-len(messages)+index+1)
	}
	return results, nil
}

// Set PARKOPTICON_TEST_DATABASE_URL to run this against a disposable PostGIS
// database. Keeping it opt-in means ordinary unit-test runs never mutate a
// developer's local database.
func TestAlertDispatcherPipelineIntegration(t *testing.T) {
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
	alertOneID := uuid.New()
	alertTwoID := uuid.New()
	alertThreeID := uuid.New()
	sessionOneID := uuid.New()
	sessionTwoID := uuid.New()
	jobOneID := uuid.New()
	jobTwoID := uuid.New()
	jobThreeID := uuid.New()

	t.Cleanup(func() {
		if _, err := db.Exec(`DELETE FROM enforcement_alerts WHERE id IN ($1, $2, $3)`, alertOneID, alertTwoID, alertThreeID); err != nil {
			t.Errorf("clean up alerts: %v", err)
		}
		if _, err := db.Exec(`DELETE FROM users WHERE id = $1`, userID); err != nil {
			t.Errorf("clean up user: %v", err)
		}
	})

	username := "worker" + userID.String()[:12]
	if _, err := db.Exec(`
		INSERT INTO users (
			id, email, password_hash, username, notifications_enabled,
			enforcement_alerts_enabled, notification_radius_meters
		)
		VALUES ($1, $2, 'not-used-by-test', $3, true, true, 300)
	`, userID, username+"@example.com", username); err != nil {
		t.Fatalf("seed user: %v", err)
	}
	pushToken := fmt.Sprintf("ExpoPushToken[dispatcher-%s]", userID)
	if _, err := db.Exec(`
		INSERT INTO user_devices (user_id, push_token)
		VALUES ($1, $2)
	`, userID, pushToken); err != nil {
		t.Fatalf("seed device: %v", err)
	}

	now := time.Now().UTC()
	if _, err := db.Exec(`
		INSERT INTO parking_sessions (
			id, user_id, location, latitude, longitude, started_at, is_active
		)
		VALUES (
			$1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography,
			$4, $3, $5, true
		)
	`, sessionOneID, userID, -122.4194, 37.7749, now.Add(-2*time.Minute)); err != nil {
		t.Fatalf("seed initial parking session: %v", err)
	}
	if _, err := db.Exec(`
		INSERT INTO enforcement_alerts (
			id, reporter_id, location, latitude, longitude, enforcement_type,
			description, severity, status, created_at, expires_at
		)
		VALUES (
			$1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography,
			$4, $3, 'ticketing', 'Integration alert one', 'high', 'active', $5, $6
		)
	`, alertOneID, userID, -122.41945, 37.77495, now.Add(-time.Minute), now.Add(time.Hour)); err != nil {
		t.Fatalf("seed new enforcement alert: %v", err)
	}
	if _, err := db.Exec(`
		INSERT INTO alert_dispatch_jobs (id, event_type, alert_id)
		VALUES ($1, 'enforcement_alert_created', $2)
	`, jobOneID, alertOneID); err != nil {
		t.Fatalf("seed alert job: %v", err)
	}

	dispatcher := NewAlertDispatcher(db, &config.Config{Worker: config.WorkerConfig{
		AlertDispatchInterval: time.Second,
		JobLeaseDuration:      time.Minute,
		DispatchBatchSize:     10,
		DeliveryBatchSize:     10,
	}})
	sender := &recordingPushSender{}
	dispatcher.push = sender

	if err := dispatcher.ProcessOnce(context.Background()); err != nil {
		t.Fatalf("dispatch new alert: %v", err)
	}
	assertJobStatus(t, db, jobOneID, "completed")
	assertNotificationCount(t, db, userID, 1)
	assertSessionAlertCount(t, db, sessionOneID, 1)
	assertDeliveryCount(t, db, userID, "sent", 1)
	if len(sender.messages) != 1 || sender.messages[0].Data["alert_id"] != alertOneID.String() {
		t.Fatalf("expected one delivered alert-one message, got %#v", sender.messages)
	}

	// Ending the first session lets the same user park again. The second alert
	// existed before that new session, so this exercises the parking-session
	// event path rather than the new-alert event path.
	if _, err := db.Exec(`
		UPDATE parking_sessions
		SET is_active = false, ended_at = CURRENT_TIMESTAMP
		WHERE id = $1
	`, sessionOneID); err != nil {
		t.Fatalf("end initial session: %v", err)
	}
	if _, err := db.Exec(`
		INSERT INTO enforcement_alerts (
			id, reporter_id, location, latitude, longitude, enforcement_type,
			description, severity, status, created_at, expires_at
		)
		VALUES (
			$1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography,
			$4, $3, 'chalking', 'Integration alert two', 'medium', 'active', $5, $6
		)
	`, alertTwoID, userID, -122.41945, 37.77495, now.Add(-30*time.Second), now.Add(time.Hour)); err != nil {
		t.Fatalf("seed existing enforcement alert: %v", err)
	}
	if _, err := db.Exec(`
		INSERT INTO parking_sessions (
			id, user_id, location, latitude, longitude, started_at, is_active
		)
		VALUES (
			$1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography,
			$4, $3, $5, true
		)
	`, sessionTwoID, userID, -122.4194, 37.7749, now); err != nil {
		t.Fatalf("seed subsequent parking session: %v", err)
	}
	if _, err := db.Exec(`
		INSERT INTO alert_dispatch_jobs (id, event_type, parking_session_id)
		VALUES ($1, 'parking_session_started', $2)
	`, jobTwoID, sessionTwoID); err != nil {
		t.Fatalf("seed session job: %v", err)
	}

	if err := dispatcher.ProcessOnce(context.Background()); err != nil {
		t.Fatalf("dispatch parking-session lookup: %v", err)
	}
	assertJobStatus(t, db, jobTwoID, "completed")
	assertNotificationCount(t, db, userID, 2)
	assertSessionAlertCount(t, db, sessionTwoID, 1)
	assertDeliveryCount(t, db, userID, "sent", 2)
	if len(sender.messages) != 2 || sender.messages[1].Data["alert_id"] != alertTwoID.String() {
		t.Fatalf("expected a delivered alert-two message, got %#v", sender.messages)
	}

	// A provider outage leaves the durable delivery queued. Once it becomes
	// available again, the same notification retries instead of being dropped
	// or duplicated.
	alertThreeCreatedAt := time.Now().UTC()
	if _, err := db.Exec(`
		INSERT INTO enforcement_alerts (
			id, reporter_id, location, latitude, longitude, enforcement_type,
			description, severity, status, created_at, expires_at
		)
		VALUES (
			$1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography,
			$4, $3, 'ticketing', 'Integration alert three', 'high', 'active', $5, $6
		)
	`, alertThreeID, userID, -122.41945, 37.77495, alertThreeCreatedAt, alertThreeCreatedAt.Add(time.Hour)); err != nil {
		t.Fatalf("seed retryable enforcement alert: %v", err)
	}
	if _, err := db.Exec(`
		INSERT INTO alert_dispatch_jobs (id, event_type, alert_id)
		VALUES ($1, 'enforcement_alert_created', $2)
	`, jobThreeID, alertThreeID); err != nil {
		t.Fatalf("seed retryable alert job: %v", err)
	}
	sender.err = fmt.Errorf("temporary push provider outage")
	if err := dispatcher.ProcessOnce(context.Background()); err == nil {
		t.Fatal("expected transient push delivery failure")
	}
	assertJobStatus(t, db, jobThreeID, "completed")
	assertNotificationCount(t, db, userID, 3)
	assertDeliveryCount(t, db, userID, "pending", 1)
	if _, err := db.Exec(`
		UPDATE notification_deliveries
		SET available_at = CURRENT_TIMESTAMP - INTERVAL '1 second'
		WHERE notification_id IN (
			SELECT id FROM notifications WHERE user_id = $1 AND related_id = $2
		)
	`, userID, alertThreeID); err != nil {
		t.Fatalf("make retry delivery available: %v", err)
	}
	sender.err = nil
	if err := dispatcher.ProcessOnce(context.Background()); err != nil {
		t.Fatalf("retry push delivery: %v", err)
	}
	assertDeliveryCount(t, db, userID, "sent", 3)
	assertDeliveryAttempts(t, db, userID, alertThreeID, 2)
	if len(sender.messages) != 3 || sender.messages[2].Data["alert_id"] != alertThreeID.String() {
		t.Fatalf("expected retried alert-three message, got %#v", sender.messages)
	}

	// Completed jobs cannot fan out duplicate notifications on later cycles.
	if err := dispatcher.ProcessOnce(context.Background()); err != nil {
		t.Fatalf("repeat dispatch cycle: %v", err)
	}
	assertNotificationCount(t, db, userID, 3)
	assertDeliveryCount(t, db, userID, "sent", 3)
}

func assertJobStatus(t *testing.T, db *sqlx.DB, jobID uuid.UUID, want string) {
	t.Helper()
	var got string
	if err := db.Get(&got, `SELECT status FROM alert_dispatch_jobs WHERE id = $1`, jobID); err != nil {
		t.Fatalf("load dispatch job: %v", err)
	}
	if got != want {
		t.Fatalf("unexpected dispatch job status: got %q want %q", got, want)
	}
}

func assertNotificationCount(t *testing.T, db *sqlx.DB, userID uuid.UUID, want int) {
	t.Helper()
	var got int
	if err := db.Get(&got, `SELECT COUNT(*) FROM notifications WHERE user_id = $1`, userID); err != nil {
		t.Fatalf("count notifications: %v", err)
	}
	if got != want {
		t.Fatalf("unexpected notification count: got %d want %d", got, want)
	}
}

func assertSessionAlertCount(t *testing.T, db *sqlx.DB, sessionID uuid.UUID, want int) {
	t.Helper()
	var got int
	if err := db.Get(&got, `SELECT alerts_received_count FROM parking_sessions WHERE id = $1`, sessionID); err != nil {
		t.Fatalf("load session alert count: %v", err)
	}
	if got != want {
		t.Fatalf("unexpected session alert count: got %d want %d", got, want)
	}
}

func assertDeliveryCount(t *testing.T, db *sqlx.DB, userID uuid.UUID, status string, want int) {
	t.Helper()
	var got int
	if err := db.Get(&got, `
		SELECT COUNT(*)
		FROM notification_deliveries deliveries
		JOIN notifications ON notifications.id = deliveries.notification_id
		WHERE notifications.user_id = $1 AND deliveries.status = $2
	`, userID, status); err != nil {
		t.Fatalf("count deliveries: %v", err)
	}
	if got != want {
		t.Fatalf("unexpected delivery count: got %d want %d", got, want)
	}
}

func assertDeliveryAttempts(t *testing.T, db *sqlx.DB, userID, alertID uuid.UUID, want int) {
	t.Helper()
	var got int
	if err := db.Get(&got, `
		SELECT deliveries.attempts
		FROM notification_deliveries deliveries
		JOIN notifications ON notifications.id = deliveries.notification_id
		WHERE notifications.user_id = $1 AND notifications.related_id = $2
	`, userID, alertID); err != nil {
		t.Fatalf("load delivery attempts: %v", err)
	}
	if got != want {
		t.Fatalf("unexpected delivery attempts: got %d want %d", got, want)
	}
}
