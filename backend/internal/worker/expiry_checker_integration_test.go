package worker

import (
	"testing"
	"time"

	"github.com/solace-esadnkaya/parkopticon-backend/internal/config"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/testutil"
)

func TestExpiryCheckerExpiresReportsAndScrubsOldPrivateData(t *testing.T) {
	db := testutil.OpenPostGIS(t)
	user := testutil.User(t, db, 1000)
	expiredSpot := testutil.Report(t, db, "parking", user, 43.642567, -79.387054, 0)
	expiredAlert := testutil.Report(t, db, "enforcement", user, 43.642567, -79.387054, 0)
	activeSpot := testutil.Report(t, db, "parking", user, 43.642567, -79.387054, 100)
	oldAlert := testutil.Report(t, db, "enforcement", user, 43.642567, -79.387054, 100)

	if _, err := db.Exec(`UPDATE parking_spots SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 minute' WHERE id = $1`, expiredSpot); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`UPDATE enforcement_alerts SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 minute' WHERE id = $1`, expiredAlert); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`UPDATE enforcement_alerts SET expires_at = CURRENT_TIMESTAMP - INTERVAL '91 days', address = 'private address' WHERE id = $1`, oldAlert); err != nil {
		t.Fatal(err)
	}

	checker := NewExpiryChecker(db, &config.Config{Worker: config.WorkerConfig{ExpiryCheckInterval: time.Minute}})
	checker.run()
	for _, fixture := range []struct{ table, id, want string }{
		{"parking_spots", expiredSpot.String(), "expired"},
		{"enforcement_alerts", expiredAlert.String(), "expired"},
		{"parking_spots", activeSpot.String(), "available"},
		{"enforcement_alerts", oldAlert.String(), "expired"},
	} {
		var status string
		if err := db.Get(&status, `SELECT status FROM `+fixture.table+` WHERE id = $1`, fixture.id); err != nil {
			t.Fatal(err)
		}
		if status != fixture.want {
			t.Errorf("%s %s: status %s, want %s", fixture.table, fixture.id, status, fixture.want)
		}
	}
	var address *string
	if err := db.Get(&address, `SELECT address FROM enforcement_alerts WHERE id = $1`, oldAlert); err != nil {
		t.Fatal(err)
	}
	if address != nil {
		t.Fatal("expired alert kept a private address after retention period")
	}
}
