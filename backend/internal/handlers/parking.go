package handlers

import (
	"database/sql"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/models"
)

type ParkingHandler struct {
	db *sqlx.DB
}

func NewParkingHandler(db *sqlx.DB) *ParkingHandler {
	return &ParkingHandler{db: db}
}

type MarkParkingSpotTakenRequest struct {
	Latitude  *float64 `json:"latitude"`
	Longitude *float64 `json:"longitude"`
}

// GetNearbyParkingSpots returns parking spots near a location
func (h *ParkingHandler) GetNearbyParkingSpots(c *gin.Context) {
	latStr := c.Query("latitude")
	lonStr := c.Query("longitude")
	radiusMeters := 1000.0
	if raw := c.Query("radius_meters"); raw != "" {
		parsed, parseErr := strconv.ParseFloat(raw, 64)
		if parseErr != nil || parsed <= 0 || parsed > 1500 {
			Error(c, http.StatusBadRequest, "invalid_radius", "radius_meters must be between 1 and 1500")
			return
		}
		radiusMeters = parsed
	} else if raw := c.Query("radius_miles"); raw != "" {
		parsed, parseErr := strconv.ParseFloat(raw, 64)
		if parseErr != nil || parsed <= 0 || parsed*1609.34 > 1500 {
			Error(c, http.StatusBadRequest, "invalid_radius", "radius must not exceed 1500 metres")
			return
		}
		radiusMeters = parsed * 1609.34
	}

	lat, err := strconv.ParseFloat(latStr, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid latitude"})
		return
	}

	lon, err := strconv.ParseFloat(lonStr, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid longitude"})
		return
	}
	if err := validateCoordinates(lat, lon); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	query := `
		SELECT 
			id, NULL::uuid AS reporter_id,
			ROUND(latitude::numeric, 4)::double precision AS latitude,
			ROUND(longitude::numeric, 4)::double precision AS longitude,
			address, street_name,
			spot_type, duration_estimate, notes, status, report_source, verified_by_count,
			flagged_count, created_at, expires_at, stale_at, taken_at,
			ST_Distance(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) / 1609.34 AS distance_miles
		FROM parking_spots
		WHERE 
			status = 'available'
			AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
			AND ST_DWithin(
				location, 
				ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
				$3
			)
		ORDER BY distance_miles ASC
		LIMIT 50
	`

	spots := []models.ParkingSpot{}
	err = h.db.SelectContext(c.Request.Context(), &spots, query, lon, lat, radiusMeters)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch parking spots"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"spots": spots,
		"count": len(spots),
	})
}

// MarkSpotTaken marks a parking spot as taken
func (h *ParkingHandler) MarkSpotTaken(c *gin.Context) {
	spotID := c.Param("id")

	id, err := uuid.Parse(spotID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid spot ID"})
		return
	}
	var req MarkParkingSpotTakenRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.Latitude == nil || req.Longitude == nil {
		Error(c, http.StatusBadRequest, "location_required", "Current latitude and longitude are required")
		return
	}
	if err := validateCoordinates(*req.Latitude, *req.Longitude); err != nil {
		Error(c, http.StatusBadRequest, "invalid_location", err.Error())
		return
	}

	query := `
		UPDATE parking_spots
		SET status = 'taken', taken_at = $1
		WHERE id = $2 AND status = 'available'
		  AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
		  AND ST_DWithin(
			location,
			ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography,
			300
		)
		RETURNING id
	`

	var returnedID uuid.UUID
	err = h.db.GetContext(c.Request.Context(), &returnedID, query, time.Now().UTC(), id, *req.Longitude, *req.Latitude)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Spot not found or already taken"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update spot"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Spot marked as taken"})
}

func validateCoordinates(latitude, longitude float64) error {
	if math.IsNaN(latitude) || math.IsInf(latitude, 0) || latitude < -90 || latitude > 90 {
		return fmt.Errorf("latitude must be between -90 and 90")
	}
	if math.IsNaN(longitude) || math.IsInf(longitude, 0) || longitude < -180 || longitude > 180 {
		return fmt.Errorf("longitude must be between -180 and 180")
	}
	return nil
}
