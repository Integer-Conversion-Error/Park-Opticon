package worker

import (
	"context"
	"log"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/config"
)

// ExpiryChecker expires old parking spots and enforcement alerts
type ExpiryChecker struct {
	db       *sqlx.DB
	interval time.Duration
}

func NewExpiryChecker(db *sqlx.DB, cfg *config.Config) *ExpiryChecker {
	return &ExpiryChecker{
		db:       db,
		interval: cfg.Worker.ExpiryCheckInterval,
	}
}

// Start begins the background worker and stops promptly with its process.
func (w *ExpiryChecker) Start(ctx context.Context) {
	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()

	log.Printf("Expiry checker started (interval: %v)", w.interval)
	w.run()

	for {
		select {
		case <-ctx.Done():
			log.Println("Expiry checker stopped")
			return
		case <-ticker.C:
			w.run()
		}
	}
}

func (w *ExpiryChecker) run() {
	w.expireSpots()
	w.expireAlerts()
	w.cleanupPrivateData()
}

func (w *ExpiryChecker) cleanupPrivateData() {
	statements := []string{
		`DELETE FROM parking_sessions WHERE is_active = false AND ended_at < CURRENT_TIMESTAMP - INTERVAL '30 days'`,
		`DELETE FROM notifications WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '30 days' AND (read_at IS NOT NULL OR status = 'read')`,
		`DELETE FROM account_tokens WHERE expires_at < CURRENT_TIMESTAMP OR used_at < CURRENT_TIMESTAMP - INTERVAL '7 days'`,
		`DELETE FROM user_sessions WHERE (revoked_at IS NOT NULL AND revoked_at < CURRENT_TIMESTAMP - INTERVAL '30 days') OR expires_at < CURRENT_TIMESTAMP - INTERVAL '30 days'`,
		`DELETE FROM user_mfa_recovery_codes WHERE used_at IS NOT NULL AND used_at < CURRENT_TIMESTAMP - INTERVAL '180 days'`,
		`UPDATE parking_spots SET reporter_id = NULL, notes = NULL, address = NULL WHERE expires_at < CURRENT_TIMESTAMP - INTERVAL '90 days' AND (reporter_id IS NOT NULL OR notes IS NOT NULL OR address IS NOT NULL)`,
		`UPDATE enforcement_alerts SET reporter_id = NULL, description = '' , address = NULL WHERE expires_at < CURRENT_TIMESTAMP - INTERVAL '90 days' AND (reporter_id IS NOT NULL OR description <> '' OR address IS NOT NULL)`,
		`DELETE FROM audit_logs WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '180 days'`,
	}
	for _, statement := range statements {
		if _, err := w.db.Exec(statement); err != nil {
			log.Printf("Error cleaning private data: %v", err)
		}
	}
}

func (w *ExpiryChecker) expireSpots() {
	query := `
		UPDATE parking_spots
		SET status = 'expired'
		WHERE status = 'available'
		AND expires_at IS NOT NULL
		AND expires_at < $1
	`

	result, err := w.db.Exec(query, time.Now().UTC())
	if err != nil {
		log.Printf("Error expiring parking spots: %v", err)
		return
	}

	rows, _ := result.RowsAffected()
	if rows > 0 {
		log.Printf("Expired %d parking spots", rows)
	}
}

func (w *ExpiryChecker) expireAlerts() {
	query := `
		UPDATE enforcement_alerts
		SET status = 'expired'
		WHERE status = 'active'
		AND expires_at < $1
	`

	result, err := w.db.Exec(query, time.Now().UTC())
	if err != nil {
		log.Printf("Error expiring enforcement alerts: %v", err)
		return
	}

	rows, _ := result.RowsAffected()
	if rows > 0 {
		log.Printf("Expired %d enforcement alerts", rows)
	}
}
