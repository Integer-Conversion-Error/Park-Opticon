package worker

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/config"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/notifications"
)

const (
	alertCreatedEvent      = "enforcement_alert_created"
	parkingSessionEvent    = "parking_session_started"
	maxNotificationRadiusM = 2500
)

// PushSender keeps the queue worker independent from Expo and makes delivery
// behavior testable without calling a real push provider.
type PushSender interface {
	SendBatch(context.Context, []notifications.Message) ([]notifications.SendResult, error)
}

// AlertDispatcher consumes durable alert/session jobs. Alert matching and
// provider delivery are intentionally separate: matching commits in a short
// database transaction, then the delivery queue performs external I/O.
type AlertDispatcher struct {
	db                *sqlx.DB
	interval          time.Duration
	leaseDuration     time.Duration
	dispatchBatchSize int
	deliveryBatchSize int
	workerID          string
	push              PushSender
}

type dispatchJob struct {
	ID               uuid.UUID  `db:"id"`
	EventType        string     `db:"event_type"`
	AlertID          *uuid.UUID `db:"alert_id"`
	ParkingSessionID *uuid.UUID `db:"parking_session_id"`
	Attempts         int        `db:"attempts"`
	MaxAttempts      int        `db:"max_attempts"`
}

type deliveryJob struct {
	ID             uuid.UUID  `db:"id"`
	NotificationID uuid.UUID  `db:"notification_id"`
	DeviceID       uuid.UUID  `db:"device_id"`
	Attempts       int        `db:"attempts"`
	MaxAttempts    int        `db:"max_attempts"`
	PushToken      string     `db:"push_token"`
	Title          string     `db:"title"`
	Body           string     `db:"body"`
	AlertID        *uuid.UUID `db:"alert_id"`
}

func NewAlertDispatcher(db *sqlx.DB, cfg *config.Config) *AlertDispatcher {
	hostname, err := os.Hostname()
	if err != nil || strings.TrimSpace(hostname) == "" {
		hostname = "alert-worker"
	}
	return &AlertDispatcher{
		db:                db,
		interval:          cfg.Worker.AlertDispatchInterval,
		leaseDuration:     cfg.Worker.JobLeaseDuration,
		dispatchBatchSize: cfg.Worker.DispatchBatchSize,
		deliveryBatchSize: cfg.Worker.DeliveryBatchSize,
		workerID:          fmt.Sprintf("%s-%s", hostname, uuid.NewString()),
		push:              notifications.NewExpoClient(cfg.Push.ExpoAccessToken),
	}
}

// Start continuously consumes work. It runs once immediately so a newly
// started worker does not add a full polling interval of alert latency.
func (w *AlertDispatcher) Start(ctx context.Context) {
	log.Printf("Alert dispatcher started (interval: %v, worker: %s)", w.interval, w.workerID)
	w.runAndLog(ctx)

	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			log.Printf("Alert dispatcher stopped (worker: %s)", w.workerID)
			return
		case <-ticker.C:
			w.runAndLog(ctx)
		}
	}
}

func (w *AlertDispatcher) runAndLog(ctx context.Context) {
	if err := w.ProcessOnce(ctx); err != nil && !isContextError(err) {
		log.Printf("Alert dispatcher cycle failed: %v", err)
	}
}

// ProcessOnce is exported for deterministic worker tests and one-shot jobs.
func (w *AlertDispatcher) ProcessOnce(ctx context.Context) error {
	var firstErr error
	if err := w.markExhaustedDispatchJobs(ctx); err != nil {
		firstErr = err
	}

	for index := 0; index < w.dispatchBatchSize; index++ {
		job, err := w.claimDispatchJob(ctx)
		if err == sql.ErrNoRows {
			break
		}
		if err != nil {
			if firstErr == nil {
				firstErr = err
			}
			break
		}
		if err := w.processDispatchJob(ctx, job); err != nil && firstErr == nil {
			firstErr = err
		}
	}

	if err := w.processDeliveryBatch(ctx); err != nil && firstErr == nil {
		firstErr = err
	}
	return firstErr
}

func (w *AlertDispatcher) claimDispatchJob(ctx context.Context) (*dispatchJob, error) {
	job := &dispatchJob{}
	err := w.db.GetContext(ctx, job, `
		WITH next_job AS (
			SELECT id
			FROM alert_dispatch_jobs
			WHERE (
				(status = 'pending' AND available_at <= CURRENT_TIMESTAMP)
				OR
				(status = 'processing' AND (locked_at IS NULL OR locked_at < CURRENT_TIMESTAMP - $2::interval))
			)
			AND attempts < max_attempts
			ORDER BY available_at ASC, created_at ASC
			LIMIT 1
			FOR UPDATE SKIP LOCKED
		)
		UPDATE alert_dispatch_jobs jobs
		SET status = 'processing',
			attempts = jobs.attempts + 1,
			locked_at = CURRENT_TIMESTAMP,
			locked_by = $1,
			last_error = NULL
		FROM next_job
		WHERE jobs.id = next_job.id
		RETURNING jobs.id, jobs.event_type, jobs.alert_id, jobs.parking_session_id,
			jobs.attempts, jobs.max_attempts
	`, w.workerID, w.leaseDuration.String())
	if err != nil {
		return nil, err
	}
	return job, nil
}

func (w *AlertDispatcher) processDispatchJob(ctx context.Context, job *dispatchJob) error {
	var err error
	switch job.EventType {
	case alertCreatedEvent:
		if job.AlertID == nil {
			err = fmt.Errorf("alert dispatch job %s has no alert id", job.ID)
		} else {
			err = w.fanOutAlert(ctx, *job.AlertID)
		}
	case parkingSessionEvent:
		if job.ParkingSessionID == nil {
			err = fmt.Errorf("session dispatch job %s has no parking session id", job.ID)
		} else {
			err = w.fanOutSession(ctx, *job.ParkingSessionID)
		}
	default:
		err = fmt.Errorf("unknown alert dispatch event type %q", job.EventType)
	}

	if err != nil {
		if retryErr := w.retryOrFailDispatchJob(ctx, job, err); retryErr != nil {
			return fmt.Errorf("process dispatch job %s: %v; reschedule: %w", job.ID, err, retryErr)
		}
		return err
	}
	if _, err := w.db.ExecContext(ctx, `
		UPDATE alert_dispatch_jobs
		SET status = 'completed', completed_at = CURRENT_TIMESTAMP,
			locked_at = NULL, locked_by = NULL, last_error = NULL
		WHERE id = $1 AND status = 'processing' AND locked_by = $2
	`, job.ID, w.workerID); err != nil {
		return fmt.Errorf("complete dispatch job %s: %w", job.ID, err)
	}
	return nil
}

// fanOutAlert turns one new enforcement report into notifications only for
// active sessions that were parked when the report was created. ST_DWithin at
// the maximum allowed radius enables the partial GiST session index; the exact
// per-user radius is then applied as a second filter.
func (w *AlertDispatcher) fanOutAlert(ctx context.Context, alertID uuid.UUID) error {
	tx, err := w.db.BeginTxx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin alert fan-out: %w", err)
	}
	defer tx.Rollback()

	_, err = tx.ExecContext(ctx, `
		WITH recipients AS MATERIALIZED (
			SELECT ps.id AS session_id,
			       ps.user_id,
			       ea.id AS alert_id,
			       ROUND(ST_Distance(ps.location, ea.location))::INTEGER AS distance_meters
			FROM enforcement_alerts ea
			JOIN parking_sessions ps ON ps.is_active = true
			JOIN users u ON u.id = ps.user_id
			WHERE ea.id = $1
			  AND ea.status = 'active'
			  AND ea.expires_at > CURRENT_TIMESTAMP
			  AND ps.started_at <= ea.created_at
			  AND u.is_active = true
			  AND u.notifications_enabled = true
			  AND u.enforcement_alerts_enabled = true
			  AND ST_DWithin(ps.location, ea.location, $2)
			  AND ST_Distance(ps.location, ea.location) <= u.notification_radius_meters
		),
		inserted_notifications AS (
			INSERT INTO notifications (
				user_id, title, body, notification_type, related_type, related_id
			)
			SELECT r.user_id,
			       $3,
			       format('Parking enforcement detected near your parked vehicle (%s metres away)', r.distance_meters),
			       'enforcement_alert', 'enforcement_alert', r.alert_id
			FROM recipients r
			ON CONFLICT (user_id, notification_type, related_id) WHERE related_id IS NOT NULL
			DO NOTHING
			RETURNING id, user_id, related_id
		),
		session_notification_counts AS (
			SELECT r.session_id, COUNT(*)::INTEGER AS alert_count
			FROM recipients r
			JOIN inserted_notifications n
			  ON n.user_id = r.user_id AND n.related_id = r.alert_id
			GROUP BY r.session_id
		),
		counted_sessions AS (
			UPDATE parking_sessions ps
			SET alerts_received_count = ps.alerts_received_count + counts.alert_count,
			    updated_at = CURRENT_TIMESTAMP
			FROM session_notification_counts counts
			WHERE ps.id = counts.session_id
			RETURNING ps.id
		)
		INSERT INTO notification_deliveries (notification_id, device_id)
		SELECT n.id, d.id
		FROM inserted_notifications n
		JOIN user_devices d ON d.user_id = n.user_id AND d.is_active = true
		CROSS JOIN (SELECT COUNT(*) FROM counted_sessions) AS completed_counts
		ON CONFLICT (notification_id, device_id) DO NOTHING
	`, alertID, maxNotificationRadiusM, "⚠️ Enforcement Alert Nearby!")
	if err != nil {
		return fmt.Errorf("insert alert notifications: %w", err)
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit alert fan-out: %w", err)
	}
	return nil
}

// fanOutSession performs the complementary one-time lookup when a user parks.
// It makes already-active nearby reports visible without restoring the old
// global polling loop.
func (w *AlertDispatcher) fanOutSession(ctx context.Context, parkingSessionID uuid.UUID) error {
	tx, err := w.db.BeginTxx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin session fan-out: %w", err)
	}
	defer tx.Rollback()

	_, err = tx.ExecContext(ctx, `
		WITH target_session AS MATERIALIZED (
			SELECT ps.id AS session_id,
			       ps.user_id,
			       ps.location,
			       u.notification_radius_meters
			FROM parking_sessions ps
			JOIN users u ON u.id = ps.user_id
			WHERE ps.id = $1
			  AND ps.is_active = true
			  AND u.is_active = true
			  AND u.notifications_enabled = true
			  AND u.enforcement_alerts_enabled = true
		),
		recipients AS MATERIALIZED (
			SELECT ts.session_id,
			       ts.user_id,
			       ea.id AS alert_id,
			       ROUND(ST_Distance(ea.location, ts.location))::INTEGER AS distance_meters
			FROM target_session ts
			JOIN enforcement_alerts ea ON ea.status = 'active'
				AND ea.expires_at > CURRENT_TIMESTAMP
				AND ST_DWithin(ea.location, ts.location, $2)
				AND ST_Distance(ea.location, ts.location) <= ts.notification_radius_meters
		),
		inserted_notifications AS (
			INSERT INTO notifications (
				user_id, title, body, notification_type, related_type, related_id
			)
			SELECT r.user_id,
			       $3,
			       format('Parking enforcement detected near your parked vehicle (%s metres away)', r.distance_meters),
			       'enforcement_alert', 'enforcement_alert', r.alert_id
			FROM recipients r
			ON CONFLICT (user_id, notification_type, related_id) WHERE related_id IS NOT NULL
			DO NOTHING
			RETURNING id, user_id, related_id
		),
		session_notification_counts AS (
			SELECT r.session_id, COUNT(*)::INTEGER AS alert_count
			FROM recipients r
			JOIN inserted_notifications n
			  ON n.user_id = r.user_id AND n.related_id = r.alert_id
			GROUP BY r.session_id
		),
		counted_sessions AS (
			UPDATE parking_sessions ps
			SET alerts_received_count = ps.alerts_received_count + counts.alert_count,
			    updated_at = CURRENT_TIMESTAMP
			FROM session_notification_counts counts
			WHERE ps.id = counts.session_id
			RETURNING ps.id
		)
		INSERT INTO notification_deliveries (notification_id, device_id)
		SELECT n.id, d.id
		FROM inserted_notifications n
		JOIN user_devices d ON d.user_id = n.user_id AND d.is_active = true
		CROSS JOIN (SELECT COUNT(*) FROM counted_sessions) AS completed_counts
		ON CONFLICT (notification_id, device_id) DO NOTHING
	`, parkingSessionID, maxNotificationRadiusM, "⚠️ Enforcement Alert Nearby!")
	if err != nil {
		return fmt.Errorf("insert session notifications: %w", err)
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit session fan-out: %w", err)
	}
	return nil
}

func (w *AlertDispatcher) processDeliveryBatch(ctx context.Context) error {
	if err := w.markUndeliverableDevices(ctx); err != nil {
		return err
	}
	if err := w.markExhaustedDeliveries(ctx); err != nil {
		return err
	}

	deliveries, err := w.claimDeliveryBatch(ctx)
	if err != nil || len(deliveries) == 0 {
		return err
	}

	messages := make([]notifications.Message, len(deliveries))
	for index, delivery := range deliveries {
		data := map[string]string{
			"notification_id": delivery.NotificationID.String(),
		}
		if delivery.AlertID != nil {
			data["alert_id"] = delivery.AlertID.String()
		}
		messages[index] = notifications.Message{
			Token: delivery.PushToken,
			Title: delivery.Title,
			Body:  delivery.Body,
			Data:  data,
		}
	}

	pushContext, cancel := context.WithTimeout(ctx, 15*time.Second)
	results, sendErr := w.push.SendBatch(pushContext, messages)
	cancel()
	if sendErr != nil {
		for _, delivery := range deliveries {
			if err := w.retryOrFailDelivery(ctx, delivery, sendErr, false); err != nil {
				return err
			}
		}
		return sendErr
	}
	if len(results) != len(deliveries) {
		err := fmt.Errorf("push provider returned %d results for %d deliveries", len(results), len(deliveries))
		for _, delivery := range deliveries {
			if retryErr := w.retryOrFailDelivery(ctx, delivery, err, false); retryErr != nil {
				return retryErr
			}
		}
		return err
	}

	var firstErr error
	for index, result := range results {
		delivery := deliveries[index]
		if result.Err != nil {
			if err := w.retryOrFailDelivery(ctx, delivery, result.Err, result.Permanent); err != nil && firstErr == nil {
				firstErr = err
			}
			continue
		}
		if err := w.markDeliverySent(ctx, delivery, result.TicketID); err != nil && firstErr == nil {
			firstErr = err
		}
	}
	return firstErr
}

func (w *AlertDispatcher) claimDeliveryBatch(ctx context.Context) ([]deliveryJob, error) {
	jobs := []deliveryJob{}
	err := w.db.SelectContext(ctx, &jobs, `
		WITH candidates AS (
			SELECT deliveries.id
			FROM notification_deliveries deliveries
			JOIN user_devices devices ON devices.id = deliveries.device_id AND devices.is_active = true
			WHERE (
				(deliveries.status = 'pending' AND deliveries.available_at <= CURRENT_TIMESTAMP)
				OR
				(deliveries.status = 'processing' AND (deliveries.locked_at IS NULL OR deliveries.locked_at < CURRENT_TIMESTAMP - $2::interval))
			)
			AND deliveries.attempts < deliveries.max_attempts
			ORDER BY deliveries.available_at ASC, deliveries.created_at ASC
			LIMIT $3
			FOR UPDATE OF deliveries SKIP LOCKED
		),
		claimed AS (
			UPDATE notification_deliveries deliveries
			SET status = 'processing',
				attempts = deliveries.attempts + 1,
				locked_at = CURRENT_TIMESTAMP,
				locked_by = $1,
				updated_at = CURRENT_TIMESTAMP,
				error_message = NULL
			FROM candidates
			WHERE deliveries.id = candidates.id
			RETURNING deliveries.id, deliveries.notification_id, deliveries.device_id,
				deliveries.attempts, deliveries.max_attempts
		)
		SELECT claimed.id, claimed.notification_id, claimed.device_id,
			claimed.attempts, claimed.max_attempts, devices.push_token,
			notifications.title, notifications.body, notifications.related_id AS alert_id
		FROM claimed
		JOIN user_devices devices ON devices.id = claimed.device_id
		JOIN notifications ON notifications.id = claimed.notification_id
	`, w.workerID, w.leaseDuration.String(), w.deliveryBatchSize)
	if err != nil {
		return nil, err
	}
	return jobs, nil
}

func (w *AlertDispatcher) markDeliverySent(ctx context.Context, delivery deliveryJob, ticketID string) error {
	_, err := w.db.ExecContext(ctx, `
		WITH updated_delivery AS (
			UPDATE notification_deliveries
			SET status = 'sent', sent_at = CURRENT_TIMESTAMP, provider_ticket_id = $3,
				locked_at = NULL, locked_by = NULL, error_message = NULL,
				updated_at = CURRENT_TIMESTAMP
			WHERE id = $1 AND status = 'processing' AND locked_by = $2
			RETURNING notification_id
		)
		UPDATE notifications
		SET status = 'sent', sent_at = COALESCE(sent_at, CURRENT_TIMESTAMP), error_message = NULL
		FROM updated_delivery
		WHERE notifications.id = updated_delivery.notification_id
	`, delivery.ID, w.workerID, ticketID)
	if err != nil {
		return fmt.Errorf("mark delivery %s sent: %w", delivery.ID, err)
	}
	return nil
}

func (w *AlertDispatcher) retryOrFailDispatchJob(ctx context.Context, job *dispatchJob, cause error) error {
	_, err := w.db.ExecContext(ctx, `
		UPDATE alert_dispatch_jobs
		SET status = CASE WHEN attempts >= max_attempts THEN 'failed' ELSE 'pending' END,
			available_at = CASE
				WHEN attempts >= max_attempts THEN available_at
				ELSE CURRENT_TIMESTAMP + $3::interval
			END,
			locked_at = NULL,
			locked_by = NULL,
			completed_at = CASE WHEN attempts >= max_attempts THEN CURRENT_TIMESTAMP ELSE NULL END,
			last_error = $4
		WHERE id = $1 AND status = 'processing' AND locked_by = $2
	`, job.ID, w.workerID, retryDelay(job.Attempts).String(), truncateError(cause))
	if err != nil {
		return fmt.Errorf("reschedule dispatch job %s: %w", job.ID, err)
	}
	return nil
}

func (w *AlertDispatcher) retryOrFailDelivery(ctx context.Context, delivery deliveryJob, cause error, permanent bool) error {
	if permanent {
		if _, err := w.db.ExecContext(ctx, `
			UPDATE user_devices
			SET is_active = false, updated_at = CURRENT_TIMESTAMP
			WHERE id = $1
		`, delivery.DeviceID); err != nil {
			return fmt.Errorf("deactivate invalid push device %s: %w", delivery.DeviceID, err)
		}
	}

	_, err := w.db.ExecContext(ctx, `
		UPDATE notification_deliveries
		SET status = CASE WHEN $3 OR attempts >= max_attempts THEN 'failed' ELSE 'pending' END,
			available_at = CASE
				WHEN $3 OR attempts >= max_attempts THEN available_at
				ELSE CURRENT_TIMESTAMP + $4::interval
			END,
			locked_at = NULL,
			locked_by = NULL,
			failed_at = CASE WHEN $3 OR attempts >= max_attempts THEN CURRENT_TIMESTAMP ELSE NULL END,
			error_message = $5,
			updated_at = CURRENT_TIMESTAMP
		WHERE id = $1 AND status = 'processing' AND locked_by = $2
	`, delivery.ID, w.workerID, permanent, retryDelay(delivery.Attempts).String(), truncateError(cause))
	if err != nil {
		return fmt.Errorf("reschedule delivery %s: %w", delivery.ID, err)
	}

	if permanent || delivery.Attempts >= delivery.MaxAttempts {
		if _, err := w.db.ExecContext(ctx, `
			UPDATE notifications
			SET status = 'failed', error_message = $2
			WHERE id = $1
			  AND NOT EXISTS (
				SELECT 1
				FROM notification_deliveries
				WHERE notification_id = $1
				  AND status IN ('pending', 'processing', 'sent')
			  )
		`, delivery.NotificationID, truncateError(cause)); err != nil {
			return fmt.Errorf("mark notification %s failed: %w", delivery.NotificationID, err)
		}
	}
	return nil
}

func (w *AlertDispatcher) markExhaustedDispatchJobs(ctx context.Context) error {
	_, err := w.db.ExecContext(ctx, `
		UPDATE alert_dispatch_jobs
		SET status = 'failed', completed_at = CURRENT_TIMESTAMP,
			locked_at = NULL, locked_by = NULL,
			last_error = COALESCE(last_error, 'maximum dispatch attempts reached')
		WHERE (status = 'pending' AND attempts >= max_attempts)
		   OR (status = 'processing' AND attempts >= max_attempts
		       AND (locked_at IS NULL OR locked_at < CURRENT_TIMESTAMP - $1::interval))
	`, w.leaseDuration.String())
	if err != nil {
		return fmt.Errorf("mark exhausted dispatch jobs: %w", err)
	}
	return nil
}

func (w *AlertDispatcher) markExhaustedDeliveries(ctx context.Context) error {
	_, err := w.db.ExecContext(ctx, `
		UPDATE notification_deliveries
		SET status = 'failed', failed_at = CURRENT_TIMESTAMP,
			locked_at = NULL, locked_by = NULL,
			error_message = COALESCE(error_message, 'maximum delivery attempts reached'),
			updated_at = CURRENT_TIMESTAMP
		WHERE (status = 'pending' AND attempts >= max_attempts)
		   OR (status = 'processing' AND attempts >= max_attempts
		       AND (locked_at IS NULL OR locked_at < CURRENT_TIMESTAMP - $1::interval))
	`, w.leaseDuration.String())
	if err != nil {
		return fmt.Errorf("mark exhausted deliveries: %w", err)
	}
	return nil
}

func (w *AlertDispatcher) markUndeliverableDevices(ctx context.Context) error {
	_, err := w.db.ExecContext(ctx, `
		UPDATE notification_deliveries deliveries
		SET status = 'failed', failed_at = CURRENT_TIMESTAMP,
			locked_at = NULL, locked_by = NULL,
			error_message = COALESCE(deliveries.error_message, 'push device is inactive'),
			updated_at = CURRENT_TIMESTAMP
		FROM user_devices devices
		WHERE devices.id = deliveries.device_id
		  AND devices.is_active = false
		  AND deliveries.status IN ('pending', 'processing')
	`)
	if err != nil {
		return fmt.Errorf("mark inactive device deliveries: %w", err)
	}
	return nil
}

func retryDelay(attempt int) time.Duration {
	if attempt < 1 {
		attempt = 1
	}
	if attempt > 9 {
		attempt = 9
	}
	return time.Second * time.Duration(1<<uint(attempt-1))
}

func truncateError(err error) string {
	if err == nil {
		return ""
	}
	message := err.Error()
	if len(message) > 2000 {
		return message[:2000]
	}
	return message
}

func isContextError(err error) bool {
	return err == context.Canceled || err == context.DeadlineExceeded
}
