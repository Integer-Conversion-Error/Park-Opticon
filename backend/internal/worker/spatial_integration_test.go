package worker

import (
	"context"
	"fmt"
	"testing"

	"github.com/google/uuid"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/config"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/testutil"
)

func TestAlertMatchingRadiusIntegration(t *testing.T) {
	db := testutil.OpenPostGIS(t)
	dispatcher := NewAlertDispatcher(db, &config.Config{})
	for _, origin := range []struct {
		name          string
		lon           float64
		exactBoundary bool
	}{
		{"equator", 0, true},
		// Longitude wrap introduces floating-point projection error. Use 10 cm
		// inside/outside here; exact inclusive boundaries are tested at longitude 0.
		{"antimeridian", 179.999, false},
	} {
		for _, event := range []string{"new_report", "new_session"} {
			for _, radius := range []int{100, 300, 1000, 1500} {
				t.Run(fmt.Sprintf("%s/%s/radius_%d", origin.name, event, radius), func(t *testing.T) {
					author := testutil.User(t, db, 1000)
					recipient := testutil.User(t, db, radius)
					session := testutil.Session(t, db, recipient, 0, origin.lon)
					distances := []float64{0, float64(radius) - 0.1, float64(radius) + 0.1, 1600}
					wantTotal := 2
					if origin.exactBoundary {
						distances = append(distances, float64(radius))
						wantTotal++
					}
					var reports []uuid.UUID
					for _, distance := range distances {
						reports = append(reports, testutil.Report(t, db, "enforcement", author, 0, origin.lon, distance))
					}
					// Both matching directions must respect each recipient's chosen radius,
					// including the 1.5 km prefilter, and avoid duplicate notifications.
					for attempt := 0; attempt < 2; attempt++ {
						if event == "new_report" {
							for _, report := range reports {
								if err := dispatcher.fanOutAlert(context.Background(), report); err != nil {
									t.Fatal(err)
								}
							}
						} else if err := dispatcher.fanOutSession(context.Background(), session); err != nil {
							t.Fatal(err)
						}
					}
					for i, report := range reports {
						var count int
						if err := db.Get(&count, `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND related_id = $2`, recipient, report); err != nil {
							t.Fatal(err)
						}
						want := 0
						if distances[i] <= float64(radius) {
							want = 1
						}
						if count != want {
							t.Fatalf("distance %.1f m: got %d notifications, want %d", distances[i], count, want)
						}
					}
					assertNotificationCount(t, db, recipient, wantTotal)
					assertSessionAlertCount(t, db, session, wantTotal)
				})
			}
		}
	}
}
