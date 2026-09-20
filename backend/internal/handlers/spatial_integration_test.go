package handlers

import (
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/testutil"
)

func TestNearbyFeedSpatialIntegration(t *testing.T) {
	db := testutil.OpenPostGIS(t)
	gin.SetMode(gin.TestMode)
	for _, origin := range []struct {
		name     string
		lat, lon float64
	}{
		{"equator", 0, 0}, {"city", 45.4215, -75.6972},
		{"antimeridian", 0, 179.999}, {"high_latitude", 80, 30},
	} {
		t.Run(origin.name, func(t *testing.T) {
			author := testutil.User(t, db, 1000)
			viewer := testutil.User(t, db, 300)
			// Insert out of order; the response must sort by unrounded distance.
			distances := []float64{300.1, 100, 299.9, 0, 30}
			ids := map[string][]uuid.UUID{}
			for _, kind := range []string{"parking", "enforcement"} {
				for _, distance := range distances {
					ids[kind] = append(ids[kind], testutil.Report(t, db, kind, author, origin.lat, origin.lon, distance))
				}
				expired := testutil.Report(t, db, kind, author, origin.lat, origin.lon, 10)
				inactive := testutil.Report(t, db, kind, author, origin.lat, origin.lon, 20)
				table, status := "parking_spots", "taken"
				if kind == "enforcement" {
					table, status = "enforcement_alerts", "resolved"
				}
				if _, err := db.Exec(fmt.Sprintf(`UPDATE %s SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 second' WHERE id = $1`, table), expired); err != nil {
					t.Fatal(err)
				}
				if _, err := db.Exec(fmt.Sprintf(`UPDATE %s SET status = $1 WHERE id = $2`, table), status, inactive); err != nil {
					t.Fatal(err)
				}
			}
			router := gin.New()
			router.Use(func(c *gin.Context) { c.Set("user_id", viewer); c.Next() })
			router.GET("/feed", NewFeedHandler(db).Nearby)
			for _, radiusQuery := range []string{"", "&radius_meters=300"} {
				response := httptest.NewRecorder()
				router.ServeHTTP(response, httptest.NewRequest("GET", fmt.Sprintf("/feed?latitude=%.8f&longitude=%.8f%s", origin.lat, origin.lon, radiusQuery), nil))
				if response.Code != http.StatusOK {
					t.Fatalf("feed: %d %s", response.Code, response.Body.String())
				}
				var feed NearbyFeedResponse
				if err := json.Unmarshal(response.Body.Bytes(), &feed); err != nil {
					t.Fatal(err)
				}
				if feed.RadiusMeters != 300 {
					t.Fatalf("radius = %d, want 300", feed.RadiusMeters)
				}
				if len(feed.ParkingSpots) != 4 || len(feed.EnforcementAlerts) != 4 {
					t.Fatalf("unexpected feed counts: spots=%d alerts=%d", len(feed.ParkingSpots), len(feed.EnforcementAlerts))
				}
				for index, fixtureIndex := range []int{3, 4, 1, 2} {
					spot, alert := feed.ParkingSpots[index], feed.EnforcementAlerts[index]
					if spot.ID != ids["parking"][fixtureIndex] || alert.ID != ids["enforcement"][fixtureIndex] {
						t.Fatalf("incorrect inclusion/order at index %d", index)
					}
					for _, distance := range []*float64{spot.DistanceMeters, alert.DistanceMeters} {
						if distance == nil || math.Abs(*distance-distances[fixtureIndex]) > 0.01 {
							t.Fatalf("distance = %v, want %.2f m within 1 cm", distance, distances[fixtureIndex])
						}
					}
				}
			}
		})
	}
}

func TestNearbyFeedKnownDistanceIntegration(t *testing.T) {
	db := testutil.OpenPostGIS(t)
	author := testutil.User(t, db, 1000)
	// Independent WGS84 reference: 0.001 degrees of longitude at the equator
	// is 6378137 * pi / 180000 = 111.319490793 metres.
	for _, kind := range []string{"parking", "enforcement"} {
		testutil.Report(t, db, kind, author, 0, 0.001, 0)
	}
	router := gin.New()
	router.GET("/feed", NewFeedHandler(db).Nearby)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest("GET", "/feed?latitude=0&longitude=0&radius_meters=200", nil))
	if response.Code != http.StatusOK {
		t.Fatalf("feed: %d %s", response.Code, response.Body.String())
	}
	var feed NearbyFeedResponse
	if err := json.Unmarshal(response.Body.Bytes(), &feed); err != nil {
		t.Fatal(err)
	}
	if len(feed.ParkingSpots) != 1 || len(feed.EnforcementAlerts) != 1 {
		t.Fatal("expected one report of each type")
	}
	for _, distance := range []*float64{feed.ParkingSpots[0].DistanceMeters, feed.EnforcementAlerts[0].DistanceMeters} {
		if distance == nil || math.Abs(*distance-111.319490793) > 0.001 {
			t.Fatalf("wrong known distance: %v", distance)
		}
	}
}

func TestVerificationProximityIntegration(t *testing.T) {
	db := testutil.OpenPostGIS(t)
	gin.SetMode(gin.TestMode)
	for _, kind := range []string{"parking", "enforcement"} {
		for _, radius := range []int{100, 1500} {
			t.Run(fmt.Sprintf("%s/preference_%d", kind, radius), func(t *testing.T) {
				author := testutil.User(t, db, 1000)
				verifier := testutil.User(t, db, radius)
				router := gin.New()
				router.Use(func(c *gin.Context) { c.Set("user_id", verifier); c.Next() })
				handler := NewVerificationHandler(db)
				verify := handler.VerifyParkingSpot
				if kind == "enforcement" {
					verify = handler.VerifyEnforcementAlert
				}
				router.POST("/reports/:id/verify", verify)
				for _, distance := range []float64{0, 200, 299.9, 300, 300.1, 500} {
					report := testutil.Report(t, db, kind, author, 0, 0, distance)
					response := httptest.NewRecorder()
					request := httptest.NewRequest("POST", "/reports/"+report.String()+"/verify", strings.NewReader(`{"latitude":0,"longitude":0,"verification_type":"confirm"}`))
					request.Header.Set("Content-Type", "application/json")
					router.ServeHTTP(response, request)
					wantStatus, wantCount := http.StatusOK, 1
					if distance > 300 {
						wantStatus, wantCount = http.StatusNotFound, 0
					}
					if response.Code != wantStatus {
						t.Fatalf("distance %.1f m: status %d want %d: %s", distance, response.Code, wantStatus, response.Body.String())
					}
					var count int
					if err := db.Get(&count, `SELECT COUNT(*) FROM verifications WHERE verifiable_id = $1`, report); err != nil {
						t.Fatal(err)
					}
					if count != wantCount {
						t.Fatalf("distance %.1f m: saved %d verifications, want %d", distance, count, wantCount)
					}
				}
			})
		}
	}
}
