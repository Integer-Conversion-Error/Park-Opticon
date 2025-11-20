package worker

import (
	"log"
	"time"

	"github.com/jmoiron/sqlx"
)

// ExpiryChecker expires old parking spots and enforcement alerts
type ExpiryChecker struct {
	db       *sqlx.DB
	interval time.Duration
}

func NewExpiryChecker(db *sqlx.DB) *ExpiryChecker {
	return &ExpiryChecker{
		db:       db,
		interval: 5 * time.Minute,
	}
}

// Start begins the background worker
func (w *ExpiryChecker) Start() {
	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()

	log.Printf("Expiry checker started (interval: %v)", w.interval)

	for range ticker.C {
		w.expireSpots()
		w.expireAlerts()
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

	result, err := w.db.Exec(query, time.Now())
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

	result, err := w.db.Exec(query, time.Now())
	if err != nil {
		log.Printf("Error expiring enforcement alerts: %v", err)
		return
	}

	rows, _ := result.RowsAffected()
	if rows > 0 {
		log.Printf("Expired %d enforcement alerts", rows)
	}
}
