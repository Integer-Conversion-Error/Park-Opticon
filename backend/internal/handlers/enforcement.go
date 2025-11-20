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

type EnforcementHandler struct {
	db *sqlx.DB
}

func NewEnforcementHandler(db *sqlx.DB) *EnforcementHandler {
	return &EnforcementHandler{db: db}
}

type CreateEnforcementAlertRequest struct {
	Latitude        float64 `json:"latitude" binding:"required"`
	Longitude       float64 `json:"longitude" binding:"required"`
	Address         *string `json:"address"`
	StreetName      *string `json:"street_name"`
	EnforcementType string  `json:"enforcement_type" binding:"required,oneof=ticketing chalking towing"`
	Description     string  `json:"description" binding:"required"`
	Severity        string  `json:"severity" binding:"oneof=low medium high"`
}

// CreateEnforcementAlert creates a new enforcement alert
func (h *EnforcementHandler) CreateEnforcementAlert(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	var req CreateEnforcementAlertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Default severity
	if req.Severity == "" {
		req.Severity = "medium"
	}

	// Insert enforcement alert
	alert := &models.EnforcementAlert{}
	query := `
		INSERT INTO enforcement_alerts (
			reporter_id, location, latitude, longitude, address, street_name,
			enforcement_type, description, severity
		)
		VALUES (
			$1, ST_SetSRID(ST_MakePoint($2, $3), 4326), $3, $4, $5, $6, $7, $8, $9
		)
		RETURNING id, reporter_id, latitude, longitude, address, street_name,
		          enforcement_type, description, severity, status, verified_by_count,
		          flagged_count, created_at, expires_at
	`
	err := h.db.QueryRowx(
		query, userID, req.Longitude, req.Latitude, req.Latitude, req.Longitude,
		req.Address, req.StreetName, req.EnforcementType, req.Description, req.Severity,
	).StructScan(alert)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create enforcement alert"})
		return
	}

	// Award karma points to reporter
	_, _ = h.db.Exec("UPDATE users SET karma_points = karma_points + 10 WHERE id = $1", userID)

	// TODO: Trigger push notifications to nearby parked users (handled by background worker)

	c.JSON(http.StatusCreated, alert)
}

// GetNearbyEnforcementAlerts returns enforcement alerts near a location
func (h *EnforcementHandler) GetNearbyEnforcementAlerts(c *gin.Context) {
	latStr := c.Query("latitude")
	lonStr := c.Query("longitude")
	radiusStr := c.DefaultQuery("radius_miles", "1.0")
	alertType := c.Query("type") // Optional filter

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

	radiusMeters := radius * 1609.34

	queryStr := `
		SELECT 
			id, reporter_id, latitude, longitude, address, street_name,
			enforcement_type, description, severity, status, verified_by_count,
			flagged_count, created_at, expires_at, resolved_at,
			ST_Distance(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) / 1609.34 AS distance_miles
		FROM enforcement_alerts
		WHERE 
			status = 'active'
			AND expires_at > $3
			AND ST_DWithin(
				location, 
				ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
				$4
			)
	`

	args := []interface{}{lon, lat, time.Now(), radiusMeters}

	if alertType != "" {
		queryStr += " AND enforcement_type = $5"
		args = append(args, alertType)
	}

	queryStr += " ORDER BY distance_miles ASC LIMIT 100"

	alerts := []models.EnforcementAlert{}
	err = h.db.Select(&alerts, queryStr, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch enforcement alerts"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"alerts": alerts,
		"count":  len(alerts),
	})
}

// ResolveEnforcementAlert marks an alert as resolved
func (h *EnforcementHandler) ResolveEnforcementAlert(c *gin.Context) {
	alertID := c.Param("id")

	id, err := uuid.Parse(alertID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid alert ID"})
		return
	}

	query := `
		UPDATE enforcement_alerts
		SET status = 'resolved', resolved_at = $1
		WHERE id = $2 AND status = 'active'
	`

	result, err := h.db.Exec(query, time.Now(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to resolve alert"})
		return
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Alert not found or already resolved"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Alert resolved"})
}
