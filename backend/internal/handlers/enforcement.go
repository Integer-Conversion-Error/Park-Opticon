package handlers

import (
	"database/sql"
	"math"
	"net/http"
	"strconv"
	"strings"
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
	Latitude        float64  `json:"latitude" binding:"required"`
	Longitude       float64  `json:"longitude" binding:"required"`
	AccuracyMeters  *float64 `json:"accuracy_meters,omitempty"`
	Address         *string  `json:"address"`
	StreetName      *string  `json:"street_name"`
	EnforcementType string   `json:"enforcement_type" binding:"required,oneof=ticketing chalking"`
	Description     string   `json:"description"`
	Severity        string   `json:"severity" binding:"omitempty,oneof=low medium high"`
}

// CreateEnforcementAlert creates a new enforcement alert
func (h *EnforcementHandler) CreateEnforcementAlert(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	var req CreateEnforcementAlertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := validateCoordinates(req.Latitude, req.Longitude); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if len([]rune(req.Description)) > 1000 || (req.Address != nil && len([]rune(*req.Address)) > 500) || (req.StreetName != nil && len([]rune(*req.StreetName)) > 200) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Report text fields are too long"})
		return
	}
	req.Description = strings.TrimSpace(req.Description)

	if req.AccuracyMeters != nil && (math.IsNaN(*req.AccuracyMeters) || math.IsInf(*req.AccuracyMeters, 0) || *req.AccuracyMeters < 0 || *req.AccuracyMeters > 50) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Report GPS accuracy must be within 50 meters"})
		return
	}

	if req.Description == "" {
		if req.EnforcementType == "chalking" {
			req.Description = "Officer chalking tires"
		} else {
			req.Description = "Officer writing parking tickets"
		}
	}

	// Default severity
	if req.Severity == "" {
		req.Severity = "medium"
	}

	// A second report of the same enforcement type in the same place and
	// short time window strengthens the original report instead of creating
	// noisy duplicate pins on the map.
	existing := &models.EnforcementAlert{}
	mergeErr := h.db.GetContext(c.Request.Context(), existing, `
		SELECT id, NULL::uuid AS reporter_id,
		       ROUND(latitude::numeric, 4)::double precision AS latitude,
		       ROUND(longitude::numeric, 4)::double precision AS longitude,
		       address,
		       street_name, enforcement_type, description, severity, status,
		       verified_by_count, flagged_count, created_at, expires_at, resolved_at
		FROM enforcement_alerts
		WHERE status = 'active'
		  AND expires_at > CURRENT_TIMESTAMP
		  AND created_at >= CURRENT_TIMESTAMP - INTERVAL '10 minutes'
		  AND enforcement_type = $1
		  AND (reporter_id IS NULL OR reporter_id <> $2)
		  AND ST_DWithin(
				location,
				ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography,
				300
		  )
		ORDER BY created_at DESC
		LIMIT 1
	`, req.EnforcementType, userID, req.Longitude, req.Latitude)
	if mergeErr == nil {
		if _, err := h.db.ExecContext(c.Request.Context(), `
			INSERT INTO verifications (
				user_id, verifiable_type, verifiable_id, verification_type, notes
			)
			VALUES ($1, 'enforcement_alert', $2, 'confirm', $3)
			ON CONFLICT (user_id, verifiable_type, verifiable_id)
			DO UPDATE SET verification_type = 'confirm', notes = EXCLUDED.notes,
			              created_at = CURRENT_TIMESTAMP
		`, userID, existing.ID, req.Description); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to strengthen nearby enforcement alert"})
			return
		}
		if _, err := h.db.ExecContext(c.Request.Context(), `
			UPDATE enforcement_alerts ea
			SET verified_by_count = counts.confirmed_count,
			    flagged_count = counts.denied_count
			FROM (
				SELECT
					COUNT(*) FILTER (WHERE verification_type = 'confirm') AS confirmed_count,
					COUNT(*) FILTER (WHERE verification_type = 'deny') AS denied_count
				FROM verifications
				WHERE verifiable_type = 'enforcement_alert'
				  AND verifiable_id = $1
			) counts
			WHERE ea.id = $1
		`, existing.ID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update enforcement confidence"})
			return
		}
		_ = h.db.GetContext(c.Request.Context(), existing, `
			SELECT id, NULL::uuid AS reporter_id, latitude, longitude, address,
			       street_name, enforcement_type, description, severity, status,
			       verified_by_count, flagged_count, created_at, expires_at, resolved_at
			FROM enforcement_alerts WHERE id = $1
		`, existing.ID)
		c.JSON(http.StatusOK, gin.H{"alert": existing, "merged": true})
		return
	}
	if mergeErr != sql.ErrNoRows {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check nearby enforcement alerts"})
		return
	}

	// Insert enforcement alert
	tx, err := h.db.BeginTxx(c.Request.Context(), nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start enforcement alert transaction"})
		return
	}
	defer tx.Rollback()

	alert := &models.EnforcementAlert{}
	query := `
		INSERT INTO enforcement_alerts (
			reporter_id, location, latitude, longitude, address, street_name,
			enforcement_type, description, severity
		)
		VALUES (
			$1, ST_SetSRID(ST_MakePoint($2, $3), 4326), $3, $2, $4, $5, $6, $7, $8
		)
			RETURNING id, NULL::uuid AS reporter_id, latitude, longitude, address, street_name,
		          enforcement_type, description, severity, status, verified_by_count,
		          flagged_count, created_at, expires_at
	`
	err = tx.QueryRowxContext(c.Request.Context(),
		query, userID, req.Longitude, req.Latitude, req.Address, req.StreetName,
		req.EnforcementType, req.Description, req.Severity,
	).StructScan(alert)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create enforcement alert"})
		return
	}

	// Keep the alert and its dispatch job atomic. A successfully reported alert
	// can never be lost between the HTTP handler and the background worker.
	if _, err = tx.ExecContext(c.Request.Context(), "UPDATE users SET karma_points = karma_points + 10 WHERE id = $1", userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to award report karma"})
		return
	}
	if _, err = tx.ExecContext(c.Request.Context(), `
		INSERT INTO alert_dispatch_jobs (event_type, alert_id)
		VALUES ('enforcement_alert_created', $1)
		ON CONFLICT (event_type, alert_id) DO NOTHING
	`, alert.ID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to queue enforcement alert"})
		return
	}
	if err = tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save enforcement alert"})
		return
	}

	c.JSON(http.StatusCreated, alert)
}

// GetNearbyEnforcementAlerts returns enforcement alerts near a location
func (h *EnforcementHandler) GetNearbyEnforcementAlerts(c *gin.Context) {
	latStr := c.Query("latitude")
	lonStr := c.Query("longitude")
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
	if err := validateCoordinates(lat, lon); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	radiusMeters := 1000.0
	if raw := c.Query("radius_meters"); raw != "" {
		parsed, parseErr := strconv.ParseFloat(raw, 64)
		if parseErr != nil || parsed <= 0 || parsed > 2500 {
			Error(c, http.StatusBadRequest, "invalid_radius", "radius_meters must be between 1 and 2500")
			return
		}
		radiusMeters = parsed
	} else if raw := c.Query("radius_miles"); raw != "" {
		parsed, parseErr := strconv.ParseFloat(raw, 64)
		if parseErr != nil || parsed <= 0 || parsed*1609.34 > 2500 {
			Error(c, http.StatusBadRequest, "invalid_radius", "radius must not exceed 2500 metres")
			return
		}
		radiusMeters = parsed * 1609.34
	}

	queryStr := `
		SELECT 
			id, NULL::uuid AS reporter_id,
			ROUND(latitude::numeric, 4)::double precision AS latitude,
			ROUND(longitude::numeric, 4)::double precision AS longitude,
			address, street_name,
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

	args := []interface{}{lon, lat, time.Now().UTC(), radiusMeters}

	if alertType != "" {
		queryStr += " AND enforcement_type = $5"
		args = append(args, alertType)
	}

	queryStr += " ORDER BY distance_miles ASC LIMIT 100"

	alerts := []models.EnforcementAlert{}
	err = h.db.SelectContext(c.Request.Context(), &alerts, queryStr, args...)
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
	userID := c.MustGet("user_id").(uuid.UUID)
	isAdmin, _ := c.Get("is_admin")
	admin := false
	if value, ok := isAdmin.(bool); ok {
		admin = value
	}
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
		  AND (reporter_id = $3 OR $4 = true)
	`

	result, err := h.db.ExecContext(c.Request.Context(), query, time.Now().UTC(), id, userID, admin)
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
