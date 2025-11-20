package worker

import (
	"fmt"
	"log"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/config"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/models"
)

// AlertChecker checks for enforcement alerts near active parking sessions
type AlertChecker struct {
	db       *sqlx.DB
	cfg      *config.Config
	interval time.Duration
}

func NewAlertChecker(db *sqlx.DB, cfg *config.Config) *AlertChecker {
	return &AlertChecker{
		db:       db,
		cfg:      cfg,
		interval: cfg.Worker.AlertCheckInterval,
	}
}

// Start begins the background worker
func (w *AlertChecker) Start() {
	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()

	log.Printf("Alert checker started (interval: %v)", w.interval)

	for range ticker.C {
		w.checkAlerts()
	}
}

func (w *AlertChecker) checkAlerts() {
	// Get all active parking sessions
	query := `
		SELECT 
			ps.id, ps.user_id, ps.latitude, ps.longitude, ps.location,
			u.enforcement_alerts_enabled, u.parking_radius_miles, u.push_notification_token
		FROM parking_sessions ps
		JOIN users u ON ps.user_id = u.id
		WHERE ps.is_active = true
		AND u.enforcement_alerts_enabled = true
		AND u.push_notification_token IS NOT NULL
	`

	type SessionWithUser struct {
		models.ParkingSession
		EnforcementAlertsEnabled bool    `db:"enforcement_alerts_enabled"`
		ParkingRadiusMiles       float64 `db:"parking_radius_miles"`
		PushToken                string  `db:"push_notification_token"`
	}

	var sessions []SessionWithUser
	err := w.db.Select(&sessions, query)
	if err != nil {
		log.Printf("Error fetching active sessions: %v", err)
		return
	}

	if len(sessions) == 0 {
		return
	}

	log.Printf("Checking %d active parking sessions for nearby enforcement alerts", len(sessions))

	// For each session, check for new enforcement alerts
	for _, session := range sessions {
		radiusMeters := session.ParkingRadiusMiles * 1609.34

		alertQuery := `
			SELECT id, enforcement_type, description, severity, latitude, longitude,
			       ST_Distance(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) / 1609.34 AS distance_miles
			FROM enforcement_alerts
			WHERE status = 'active'
			AND created_at > $3
			AND ST_DWithin(
				location,
				ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
				$4
			)
		`

		var alerts []models.EnforcementAlert
		err := w.db.Select(&alerts, alertQuery, session.Longitude, session.Latitude, session.StartedAt, radiusMeters)
		if err != nil {
			log.Printf("Error checking alerts for session %s: %v", session.ID, err)
			continue
		}

		// If new alerts found, send push notification
		for _, alert := range alerts {
			// Check if we already notified this user about this alert
			var notified bool
			_ = w.db.Get(&notified, `
				SELECT EXISTS(
					SELECT 1 FROM notifications
					WHERE user_id = $1 AND related_id = $2 AND notification_type = 'enforcement_alert'
				)
			`, session.UserID, alert.ID)

			if notified {
				continue
			}

			// Create notification record
			title := "⚠️ Enforcement Alert Nearby!"
			body := "Parking enforcement detected near your parked vehicle"

			if alert.DistanceMiles != nil {
				body = fmt.Sprintf("%s (%.2f miles away)", body, *alert.DistanceMiles)
			}

			_, err = w.db.Exec(`
				INSERT INTO notifications (
					user_id, title, body, notification_type, related_type, related_id
				) VALUES ($1, $2, $3, $4, $5, $6)
			`, session.UserID, title, body, "enforcement_alert", "enforcement_alert", alert.ID)

			if err != nil {
				log.Printf("Error creating notification: %v", err)
				continue
			}

			// Increment alerts count on session
			_, _ = w.db.Exec(`
				UPDATE parking_sessions
				SET alerts_received_count = alerts_received_count + 1
				WHERE id = $1
			`, session.ID)

			// TODO: Send actual push notification via Firebase Cloud Messaging
			log.Printf("📱 Would send push notification to user %s about alert %s", session.UserID, alert.ID)
		}
	}
}
