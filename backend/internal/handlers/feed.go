package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/models"
)

type FeedHandler struct {
	db *sqlx.DB
}

func NewFeedHandler(db *sqlx.DB) *FeedHandler {
	return &FeedHandler{db: db}
}

type NearbyFeedResponse struct {
	RadiusMeters      int                       `json:"radius_meters"`
	GeneratedAt       time.Time                 `json:"generated_at"`
	ParkingSpots      []models.ParkingSpot      `json:"parking_spots"`
	EnforcementAlerts []models.EnforcementAlert `json:"enforcement_alerts"`
}

func (h *FeedHandler) Nearby(c *gin.Context) {
	latitude, longitude, radiusMeters, err := parseFeedLocation(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if c.Query("radius_meters") == "" {
		userID := c.MustGet("user_id").(uuid.UUID)
		if err := h.db.GetContext(c.Request.Context(), &radiusMeters, `
			SELECT COALESCE(notification_radius_meters, 1000)
			FROM users
			WHERE id = $1 AND is_active = true
		`, userID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load report radius"})
			return
		}
	}

	const point = `ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography`
	parkingQuery := `
		SELECT id, NULL::uuid AS reporter_id,
		       ROUND(latitude::numeric, 4)::double precision AS latitude,
		       ROUND(longitude::numeric, 4)::double precision AS longitude,
		       address, street_name,
		       spot_type, duration_estimate, notes, status, report_source,
		       verified_by_count, flagged_count, created_at, expires_at, stale_at, taken_at,
		       ST_Distance(location, ` + point + `) AS distance_meters
		FROM parking_spots
		WHERE status = 'available'
		  AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
		  AND ST_DWithin(location, ` + point + `, $3)
		ORDER BY distance_meters ASC
		LIMIT 100
	`
	alertQuery := `
		SELECT id, NULL::uuid AS reporter_id,
		       ROUND(latitude::numeric, 4)::double precision AS latitude,
		       ROUND(longitude::numeric, 4)::double precision AS longitude,
		       address, street_name,
		       enforcement_type, description, severity, status, verified_by_count,
		       flagged_count, created_at, expires_at, resolved_at,
		       ST_Distance(location, ` + point + `) AS distance_meters
		FROM enforcement_alerts
		WHERE status = 'active'
		  AND expires_at > CURRENT_TIMESTAMP
		  AND ST_DWithin(location, ` + point + `, $3)
		ORDER BY distance_meters ASC
		LIMIT 100
	`

	var parkingSpots []models.ParkingSpot
	if err := h.db.SelectContext(c.Request.Context(), &parkingSpots, parkingQuery, longitude, latitude, radiusMeters); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load nearby parking spots"})
		return
	}
	var alerts []models.EnforcementAlert
	if err := h.db.SelectContext(c.Request.Context(), &alerts, alertQuery, longitude, latitude, radiusMeters); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load nearby enforcement alerts"})
		return
	}

	c.JSON(http.StatusOK, NearbyFeedResponse{
		RadiusMeters:      radiusMeters,
		GeneratedAt:       time.Now().UTC(),
		ParkingSpots:      emptyParkingSpots(parkingSpots),
		EnforcementAlerts: emptyAlerts(alerts),
	})
}

func parseFeedLocation(c *gin.Context) (float64, float64, int, error) {
	latitude, err := strconv.ParseFloat(c.Query("latitude"), 64)
	if err != nil || latitude < -90 || latitude > 90 {
		return 0, 0, 0, &requestError{"latitude must be between -90 and 90"}
	}
	longitude, err := strconv.ParseFloat(c.Query("longitude"), 64)
	if err != nil || longitude < -180 || longitude > 180 {
		return 0, 0, 0, &requestError{"longitude must be between -180 and 180"}
	}
	if err := validateCoordinates(latitude, longitude); err != nil {
		return 0, 0, 0, &requestError{err.Error()}
	}
	radiusMeters := 1000
	if raw := c.Query("radius_meters"); raw != "" {
		radiusMeters, err = strconv.Atoi(raw)
		if err != nil || radiusMeters < 1 || radiusMeters > 1500 {
			return 0, 0, 0, &requestError{"radius_meters must be between 1 and 1500"}
		}
	}
	return latitude, longitude, radiusMeters, nil
}

type requestError struct{ message string }

func (e *requestError) Error() string { return e.message }

func emptyParkingSpots(spots []models.ParkingSpot) []models.ParkingSpot {
	if spots == nil {
		return []models.ParkingSpot{}
	}
	return spots
}

func emptyAlerts(alerts []models.EnforcementAlert) []models.EnforcementAlert {
	if alerts == nil {
		return []models.EnforcementAlert{}
	}
	return alerts
}
