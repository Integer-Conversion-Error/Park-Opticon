package handlers

import (
	"database/sql"
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

type CreateParkingSpotRequest struct {
	Latitude         float64 `json:"latitude" binding:"required"`
	Longitude        float64 `json:"longitude" binding:"required"`
	Address          *string `json:"address"`
	StreetName       *string `json:"street_name"`
	SpotType         *string `json:"spot_type"`
	DurationEstimate *int    `json:"duration_estimate"`
	Notes            *string `json:"notes"`
}

// CreateParkingSpot creates a new parking spot report
func (h *ParkingHandler) CreateParkingSpot(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	var req CreateParkingSpotRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Calculate expiry time
	expiryMinutes := 120 // Default 2 hours
	if req.DurationEstimate != nil && *req.DurationEstimate > 0 && *req.DurationEstimate < 120 {
		expiryMinutes = *req.DurationEstimate
	}
	expiresAt := time.Now().Add(time.Duration(expiryMinutes) * time.Minute)

	// Insert parking spot
	spot := &models.ParkingSpot{}
	query := `
		INSERT INTO parking_spots (
			reporter_id, location, latitude, longitude, address, street_name,
			spot_type, duration_estimate, notes, expires_at
		)
		VALUES (
			$1, ST_SetSRID(ST_MakePoint($2, $3), 4326), $3, $4, $5, $6, $7, $8, $9, $10
		)
		RETURNING id, reporter_id, latitude, longitude, address, street_name,
		          spot_type, duration_estimate, notes, status, verified_by_count,
		          flagged_count, created_at, expires_at
	`
	err := h.db.QueryRowx(
		query, userID, req.Longitude, req.Latitude, req.Latitude, req.Longitude,
		req.Address, req.StreetName, req.SpotType, req.DurationEstimate, req.Notes, expiresAt,
	).StructScan(spot)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create parking spot"})
		return
	}

	// Award karma points to reporter
	_, _ = h.db.Exec("UPDATE users SET karma_points = karma_points + 5 WHERE id = $1", userID)

	c.JSON(http.StatusCreated, spot)
}

// GetNearbyParkingSpots returns parking spots near a location
func (h *ParkingHandler) GetNearbyParkingSpots(c *gin.Context) {
	latStr := c.Query("latitude")
	lonStr := c.Query("longitude")
	radiusStr := c.DefaultQuery("radius_miles", "1.0")

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

	radius, err := strconv.ParseFloat(radiusStr, 64)
	if err != nil || radius <= 0 || radius > 10 {
		radius = 1.0
	}

	// Convert miles to meters
	radiusMeters := radius * 1609.34

	query := `
		SELECT 
			id, reporter_id, latitude, longitude, address, street_name,
			spot_type, duration_estimate, notes, status, verified_by_count,
			flagged_count, created_at, expires_at, taken_at,
			ST_Distance(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) / 1609.34 AS distance_miles
		FROM parking_spots
		WHERE 
			status = 'available'
			AND ST_DWithin(
				location, 
				ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
				$3
			)
		ORDER BY distance_miles ASC
		LIMIT 50
	`

	spots := []models.ParkingSpot{}
	err = h.db.Select(&spots, query, lon, lat, radiusMeters)
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

	query := `
		UPDATE parking_spots
		SET status = 'taken', taken_at = $1
		WHERE id = $2 AND status = 'available'
		RETURNING id
	`

	var returnedID uuid.UUID
	err = h.db.Get(&returnedID, query, time.Now(), id)
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
