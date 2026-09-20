package handlers

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/testutil"
)

func TestAlertRadiusLimitIntegration(t *testing.T) {
	db := testutil.OpenPostGIS(t)
	user := testutil.User(t, db, 1000)
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(func(c *gin.Context) { c.Set("user_id", user); c.Next() })
	router.PATCH("/preferences", NewPreferencesHandler(db).Update)
	router.GET("/feed", NewFeedHandler(db).Nearby)
	router.GET("/parking", NewParkingHandler(db).GetNearbyParkingSpots)
	router.GET("/enforcement", NewEnforcementHandler(db).GetNearbyEnforcementAlerts)
	for _, radius := range []int{1500, 1501, 2500} {
		want := http.StatusOK
		if radius > 1500 {
			want = http.StatusBadRequest
		}
		for _, path := range []string{"/preferences", "/feed", "/parking", "/enforcement"} {
			t.Run(fmt.Sprintf("%s/%d", path, radius), func(t *testing.T) {
				request := httptest.NewRequest("GET", fmt.Sprintf("%s?latitude=0&longitude=0&radius_meters=%d", path, radius), nil)
				if path == "/preferences" {
					request = httptest.NewRequest("PATCH", path, strings.NewReader(fmt.Sprintf(`{"notification_radius_meters":%d}`, radius)))
					request.Header.Set("Content-Type", "application/json")
				}
				response := httptest.NewRecorder()
				router.ServeHTTP(response, request)
				if response.Code != want {
					t.Fatalf("status %d, want %d: %s", response.Code, want, response.Body.String())
				}
			})
		}
	}
	for _, path := range []string{"/parking", "/enforcement"} {
		response := httptest.NewRecorder()
		// One mile is 1,609.34 m: the legacy miles parameter must also honor the cap.
		router.ServeHTTP(response, httptest.NewRequest("GET", path+"?latitude=0&longitude=0&radius_miles=1", nil))
		if response.Code != http.StatusBadRequest {
			t.Fatalf("%s accepted an over-limit radius in miles: %d", path, response.Code)
		}
	}
	var saved int
	if err := db.Get(&saved, `SELECT notification_radius_meters FROM users WHERE id = $1`, user); err != nil {
		t.Fatal(err)
	}
	if saved != 1500 {
		t.Fatalf("invalid request changed saved radius to %d", saved)
	}
}
