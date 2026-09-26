package worker

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/config"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/testutil"
)

func TestWorkersStopAfterCancellation(t *testing.T) {
	db := testutil.OpenPostGIS(t)
	cfg := &config.Config{Worker: config.WorkerConfig{
		AlertDispatchInterval: time.Second,
		ExpiryCheckInterval:   time.Second,
		JobLeaseDuration:      time.Minute,
		DispatchBatchSize:     1,
		DeliveryBatchSize:     1,
	}}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	finished := make(chan struct{})
	go func() {
		NewAlertDispatcher(db, cfg).Start(ctx)
		NewExpiryChecker(db, cfg).Start(ctx)
		close(finished)
	}()
	select {
	case <-finished:
	case <-time.After(3 * time.Second):
		t.Fatal("cancelled workers did not stop promptly")
	}
}

func TestDispatchFailureIsRescheduledThenExhausted(t *testing.T) {
	db := testutil.OpenPostGIS(t)
	author := testutil.User(t, db, 1000)
	alert := testutil.Report(t, db, "enforcement", author, 43.642567, -79.387054, 0)
	dispatcher := NewAlertDispatcher(db, &config.Config{Worker: config.WorkerConfig{
		AlertDispatchInterval: time.Second,
		JobLeaseDuration:      time.Minute,
		DispatchBatchSize:     1,
		DeliveryBatchSize:     1,
	}})
	jobID := uuid.New()
	if _, err := db.Exec(`INSERT INTO alert_dispatch_jobs (id, event_type, alert_id, status, attempts, max_attempts, locked_by, locked_at)
		VALUES ($1, 'enforcement_alert_created', $2, 'processing', 1, 3, $3, CURRENT_TIMESTAMP)`, jobID, alert, dispatcher.workerID); err != nil {
		t.Fatal(err)
	}
	if err := dispatcher.retryOrFailDispatchJob(context.Background(), &dispatchJob{ID: jobID, Attempts: 1}, errors.New("temporary provider failure")); err != nil {
		t.Fatal(err)
	}
	var state struct {
		Status string `db:"status"`
		Error  string `db:"last_error"`
	}
	if err := db.Get(&state, `SELECT status, last_error FROM alert_dispatch_jobs WHERE id = $1`, jobID); err != nil {
		t.Fatal(err)
	}
	if state.Status != "pending" || state.Error != "temporary provider failure" {
		t.Fatalf("retry state: %#v", state)
	}
	if _, err := db.Exec(`UPDATE alert_dispatch_jobs SET status = 'processing', attempts = 3, locked_by = $2 WHERE id = $1`, jobID, dispatcher.workerID); err != nil {
		t.Fatal(err)
	}
	if err := dispatcher.retryOrFailDispatchJob(context.Background(), &dispatchJob{ID: jobID, Attempts: 3}, errors.New("exhausted")); err != nil {
		t.Fatal(err)
	}
	if err := db.Get(&state, `SELECT status, last_error FROM alert_dispatch_jobs WHERE id = $1`, jobID); err != nil {
		t.Fatal(err)
	}
	if state.Status != "failed" || state.Error != "exhausted" {
		t.Fatalf("exhaustion state: %#v", state)
	}
}
