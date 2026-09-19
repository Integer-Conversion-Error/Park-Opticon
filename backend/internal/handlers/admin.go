package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"math"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/models"
)

type AdminHandler struct {
	db *sqlx.DB
}

func NewAdminHandler(db *sqlx.DB) *AdminHandler {
	return &AdminHandler{db: db}
}

// GetAllUsers returns all users (admin only)
func (h *AdminHandler) GetAllUsers(c *gin.Context) {
	limit, offset, ok := parsePagination(c, 100, 200)
	if !ok {
		return
	}
	var users []models.User

	query := `
		SELECT id, email, username, full_name, phone_number, avatar_url, bio,
		       karma_points, notifications_enabled, enforcement_alerts_enabled,
		       parking_radius_miles, notification_radius_meters,
		       ask_about_enforcement_after_parking, announce_open_spot_after_unparking,
	       email_verified, is_active, is_admin, mfa_enabled,
		       created_at, updated_at, last_login_at
		FROM users
		ORDER BY created_at DESC
		LIMIT $1 OFFSET $2
	`

	err := h.db.SelectContext(c.Request.Context(), &users, query, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch users"})
		return
	}

	c.JSON(http.StatusOK, users)
}

// GetAllParkingSpots returns all parking spots (admin only)
func (h *AdminHandler) GetAllParkingSpots(c *gin.Context) {
	log.Println("[Admin] GetAllParkingSpots: Starting request")
	limit, offset, ok := parsePagination(c, 100, 200)
	if !ok {
		return
	}

	var spots []models.ParkingSpot

	query := `
		SELECT id, reporter_id, template_id, latitude, longitude, 
		       corner1_lat, corner1_lon, corner2_lat, corner2_lon,
		       corner3_lat, corner3_lon, corner4_lat, corner4_lon,
		       ST_AsGeoJSON(geofence)::text as geofence_json,
		       address, street_name, spot_type, duration_estimate, notes, status, 
		       verified_by_count, flagged_count, created_at, expires_at, taken_at
		FROM parking_spots
		ORDER BY created_at DESC
		LIMIT $1 OFFSET $2
	`

	log.Println("[Admin] GetAllParkingSpots: Executing query")
	err := h.db.SelectContext(c.Request.Context(), &spots, query, limit, offset)
	if err != nil {
		log.Printf("[Admin] GetAllParkingSpots: Database error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch parking spots"})
		return
	}

	// Load schedules for each spot
	for i := range spots {
		schedules, err := h.getSchedulesForSpot(spots[i].ID)
		if err != nil {
			log.Printf("[Admin] GetAllParkingSpots: Failed to load schedules for spot %s: %v", spots[i].ID, err)
			continue
		}
		spots[i].Schedules = schedules
	}

	log.Printf("[Admin] GetAllParkingSpots: Successfully fetched %d spots", len(spots))
	c.JSON(http.StatusOK, spots)
}

// GetParkingSpotByID returns a single parking spot
func (h *AdminHandler) GetParkingSpotByID(c *gin.Context) {
	spotID := c.Param("id")

	id, err := uuid.Parse(spotID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid spot ID"})
		return
	}

	var spot models.ParkingSpot
	query := `
		SELECT id, reporter_id, latitude, longitude, address, street_name,
		       spot_type, duration_estimate, notes, status, verified_by_count,
		       flagged_count, created_at, expires_at, taken_at
		FROM parking_spots
		WHERE id = $1
	`

	err = h.db.Get(&spot, query, id)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Parking spot not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch parking spot"})
		return
	}

	c.JSON(http.StatusOK, spot)
}

// CreateParkingSpot creates a new parking spot (admin)
func (h *AdminHandler) CreateParkingSpot(c *gin.Context) {
	log.Println("[Admin] CreateParkingSpot: Starting request")

	var req struct {
		// Option 1: Provide center point (old method)
		Latitude  *float64 `json:"latitude"`
		Longitude *float64 `json:"longitude"`
		// Option 2: Provide 4 corners (new method for polygon)
		Corner1Lat       *float64                     `json:"corner1_lat"`
		Corner1Lon       *float64                     `json:"corner1_lon"`
		Corner2Lat       *float64                     `json:"corner2_lat"`
		Corner2Lon       *float64                     `json:"corner2_lon"`
		Corner3Lat       *float64                     `json:"corner3_lat"`
		Corner3Lon       *float64                     `json:"corner3_lon"`
		Corner4Lat       *float64                     `json:"corner4_lat"`
		Corner4Lon       *float64                     `json:"corner4_lon"`
		TemplateID       *int                         `json:"template_id"`
		StreetName       *string                      `json:"street_name"`
		Address          *string                      `json:"address"`
		SpotType         *string                      `json:"spot_type"`
		DurationEstimate *int                         `json:"duration_estimate"`
		Notes            *string                      `json:"notes"`
		Status           string                       `json:"status"`
		Schedules        []models.EnforcementSchedule `json:"schedules"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		log.Printf("[Admin] CreateParkingSpot: Validation error: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate that either center point or all 4 corners are provided
	hasCenter := req.Latitude != nil && req.Longitude != nil
	hasCorners := req.Corner1Lat != nil && req.Corner1Lon != nil &&
		req.Corner2Lat != nil && req.Corner2Lon != nil &&
		req.Corner3Lat != nil && req.Corner3Lon != nil &&
		req.Corner4Lat != nil && req.Corner4Lon != nil

	if !hasCenter && !hasCorners {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Must provide either latitude/longitude OR all 4 corners"})
		return
	}
	if hasCenter {
		if err := validateCoordinates(*req.Latitude, *req.Longitude); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
	}
	if req.Status != "" && req.Status != "available" && req.Status != "occupied" && req.Status != "unknown" && req.Status != "taken" && req.Status != "expired" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid parking spot status"})
		return
	}
	if req.DurationEstimate != nil && (*req.DurationEstimate < 1 || *req.DurationEstimate > 1440) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "duration_estimate must be between 1 and 1440"})
		return
	}

	log.Printf("[Admin] CreateParkingSpot: Method=%s", map[bool]string{true: "corners", false: "center"}[hasCorners])

	// Default status to available if not provided
	if req.Status == "" {
		req.Status = "available"
	}

	spotID := uuid.New()
	log.Printf("[Admin] CreateParkingSpot: Generated spot ID: %s", spotID)

	// Start transaction for spot + schedules
	tx, err := h.db.Beginx()
	if err != nil {
		log.Printf("[Admin] CreateParkingSpot: Failed to start transaction: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create parking spot"})
		return
	}
	defer tx.Rollback()

	var query string
	var args []interface{}

	if hasCorners {
		// Create with polygon from 4 corners
		query = `
			INSERT INTO parking_spots (
				id, corner1_lat, corner1_lon, corner2_lat, corner2_lon,
				corner3_lat, corner3_lon, corner4_lat, corner4_lon,
				template_id, street_name, address, spot_type, duration_estimate, notes, status,
				verified_by_count, flagged_count
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 0, 0)
			RETURNING id, reporter_id, latitude, longitude, 
			          corner1_lat, corner1_lon, corner2_lat, corner2_lon,
			          corner3_lat, corner3_lon, corner4_lat, corner4_lon,
			          template_id, street_name, address, spot_type, duration_estimate, notes, status,
			          verified_by_count, flagged_count, created_at, expires_at, taken_at
		`
		args = []interface{}{
			spotID, req.Corner1Lat, req.Corner1Lon, req.Corner2Lat, req.Corner2Lon,
			req.Corner3Lat, req.Corner3Lon, req.Corner4Lat, req.Corner4Lon,
			req.TemplateID, req.StreetName, req.Address, req.SpotType, req.DurationEstimate, req.Notes, req.Status,
		}
	} else {
		// Create with center point only (backwards compatible)
		query = `
			INSERT INTO parking_spots (
				id, latitude, longitude, location, template_id, street_name, address, spot_type,
				duration_estimate, notes, status, verified_by_count, flagged_count
			) VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography, $6, $7, $8, $9, $10, $11, $12, 0, 0)
			RETURNING id, reporter_id, latitude, longitude,
			          corner1_lat, corner1_lon, corner2_lat, corner2_lon,
			          corner3_lat, corner3_lon, corner4_lat, corner4_lon,
			          template_id, street_name, address, spot_type, duration_estimate, notes, status,
			          verified_by_count, flagged_count, created_at, expires_at, taken_at
		`
		args = []interface{}{
			spotID, req.Latitude, req.Longitude, req.Longitude, req.Latitude, req.TemplateID,
			req.StreetName, req.Address, req.SpotType, req.DurationEstimate, req.Notes, req.Status,
		}
	}

	log.Printf("[Admin] CreateParkingSpot: Executing INSERT query")

	var spot models.ParkingSpot
	err = tx.Get(&spot, query, args...)

	if err != nil {
		log.Printf("[Admin] CreateParkingSpot: Database error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create parking spot"})
		return
	}

	// Insert schedules if provided
	if len(req.Schedules) > 0 {
		for _, schedule := range req.Schedules {
			scheduleQuery := `
				INSERT INTO enforcement_schedules (parking_spot_id, day_of_week, start_time, end_time, schedule_type, description)
				VALUES ($1, $2, $3, $4, $5, $6)
			`
			_, err = tx.Exec(scheduleQuery, spot.ID, schedule.DayOfWeek, schedule.StartTime, schedule.EndTime, schedule.ScheduleType, schedule.Description)
			if err != nil {
				log.Printf("[Admin] CreateParkingSpot: Failed to insert schedule: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create parking spot schedules"})
				return
			}
		}
	}

	// Commit transaction
	if err = tx.Commit(); err != nil {
		log.Printf("[Admin] CreateParkingSpot: Failed to commit transaction: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create parking spot"})
		return
	}

	// Load schedules
	schedules, _ := h.getSchedulesForSpot(spot.ID)
	spot.Schedules = schedules

	log.Printf("[Admin] CreateParkingSpot: Successfully created spot with ID: %s", spot.ID)
	c.JSON(http.StatusCreated, spot)
}

// UpdateParkingSpot updates an existing parking spot (admin)
func (h *AdminHandler) UpdateParkingSpot(c *gin.Context) {
	spotID := c.Param("id")

	id, err := uuid.Parse(spotID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid spot ID"})
		return
	}

	var req struct {
		Latitude         *float64                     `json:"latitude"`
		Longitude        *float64                     `json:"longitude"`
		TemplateID       *int                         `json:"template_id"`
		StreetName       *string                      `json:"street_name"`
		Address          *string                      `json:"address"`
		SpotType         *string                      `json:"spot_type"`
		DurationEstimate *int                         `json:"duration_estimate"`
		Notes            *string                      `json:"notes"`
		Status           *string                      `json:"status"`
		Schedules        []models.EnforcementSchedule `json:"schedules"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Start transaction
	tx, err := h.db.Beginx()
	if err != nil {
		log.Printf("[Admin] UpdateParkingSpot: Failed to start transaction: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update parking spot"})
		return
	}
	defer tx.Rollback()

	query := `
		UPDATE parking_spots
		SET latitude = COALESCE($2, latitude),
		    longitude = COALESCE($3, longitude),
		    template_id = COALESCE($4, template_id),
		    street_name = COALESCE($5, street_name),
		    address = COALESCE($6, address),
		    spot_type = COALESCE($7, spot_type),
		    duration_estimate = COALESCE($8, duration_estimate),
		    notes = COALESCE($9, notes),
		    status = COALESCE($10, status)
		WHERE id = $1
		RETURNING id, latitude, longitude, template_id, street_name, address, spot_type,
		          duration_estimate, notes, status, verified_by_count, flagged_count,
		          created_at, expires_at, taken_at
	`

	var spot models.ParkingSpot
	err = tx.Get(&spot, query,
		id, req.Latitude, req.Longitude, req.TemplateID, req.StreetName, req.Address,
		req.SpotType, req.DurationEstimate, req.Notes, req.Status,
	)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Parking spot not found"})
		return
	}
	if err != nil {
		log.Printf("[Admin] UpdateParkingSpot: Database error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update parking spot"})
		return
	}

	// Update schedules if provided
	if req.Schedules != nil {
		// Delete existing schedules
		_, err = tx.Exec("DELETE FROM enforcement_schedules WHERE parking_spot_id = $1", id)
		if err != nil {
			log.Printf("[Admin] UpdateParkingSpot: Failed to delete old schedules: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update schedules"})
			return
		}

		// Insert new schedules
		for _, schedule := range req.Schedules {
			scheduleQuery := `
				INSERT INTO enforcement_schedules (parking_spot_id, day_of_week, start_time, end_time, schedule_type, description)
				VALUES ($1, $2, $3, $4, $5, $6)
			`
			_, err = tx.Exec(scheduleQuery, id, schedule.DayOfWeek, schedule.StartTime, schedule.EndTime, schedule.ScheduleType, schedule.Description)
			if err != nil {
				log.Printf("[Admin] UpdateParkingSpot: Failed to insert schedule: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update schedules"})
				return
			}
		}
	}

	// Commit transaction
	if err = tx.Commit(); err != nil {
		log.Printf("[Admin] UpdateParkingSpot: Failed to commit transaction: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update parking spot"})
		return
	}

	// Load schedules
	schedules, _ := h.getSchedulesForSpot(id)
	spot.Schedules = schedules

	c.JSON(http.StatusOK, spot)
}

// DeleteParkingSpot deletes a parking spot (admin)
func (h *AdminHandler) DeleteParkingSpot(c *gin.Context) {
	spotID := c.Param("id")

	id, err := uuid.Parse(spotID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid spot ID"})
		return
	}

	query := `DELETE FROM parking_spots WHERE id = $1`

	result, err := h.db.Exec(query, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete parking spot"})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Parking spot not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Parking spot deleted successfully"})
}

// CreateGeofence creates a geofence for a parking spot (admin)
func (h *AdminHandler) CreateGeofence(c *gin.Context) {
	spotID := c.Param("id")
	log.Printf("[Admin] CreateGeofence: Starting for spot ID: %s", spotID)

	id, err := uuid.Parse(spotID)
	if err != nil {
		log.Printf("[Admin] CreateGeofence: Invalid spot ID: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid spot ID"})
		return
	}

	var req struct {
		Polygon [][][]float64 `json:"polygon" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		log.Printf("[Admin] CreateGeofence: JSON binding error: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	log.Printf("[Admin] CreateGeofence: Received polygon with %d rings", len(req.Polygon))
	if len(req.Polygon) > 0 {
		log.Printf("[Admin] CreateGeofence: First ring has %d coordinates", len(req.Polygon[0]))
	}

	// Convert polygon to PostGIS format
	// Format: POLYGON((lng1 lat1, lng2 lat2, lng3 lat3, lng1 lat1))
	if !validPolygon(req.Polygon) {
		log.Printf("[Admin] CreateGeofence: Invalid polygon - not enough coordinates")
		c.JSON(http.StatusBadRequest, gin.H{"error": "Polygon must contain closed rings with valid coordinates"})
		return
	}

	// Build GeoJSON string
	geoJSONBytes, err := json.Marshal(map[string]interface{}{
		"type":        "Polygon",
		"coordinates": req.Polygon,
	})
	if err != nil {
		log.Printf("[Admin] CreateGeofence: Failed to marshal GeoJSON: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create geofence"})
		return
	}

	log.Printf("[Admin] CreateGeofence: GeoJSON string: %s", string(geoJSONBytes))

	query := `
		UPDATE parking_spots
		SET geofence = ST_GeomFromGeoJSON($2)
		WHERE id = $1
	`

	result, err := h.db.Exec(query, id, string(geoJSONBytes))
	if err != nil {
		log.Printf("[Admin] CreateGeofence: Database error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create geofence"})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Parking spot not found"})
		return
	}
	log.Printf("[Admin] CreateGeofence: Success! Rows affected: %d", rowsAffected)

	c.JSON(http.StatusOK, gin.H{"message": "Geofence created successfully"})
}

func validPolygon(polygon [][][]float64) bool {
	if len(polygon) == 0 || len(polygon) > 10 {
		return false
	}
	for _, ring := range polygon {
		if len(ring) < 4 || len(ring) > 101 {
			return false
		}
		for _, point := range ring {
			if len(point) != 2 || math.IsNaN(point[0]) || math.IsNaN(point[1]) || math.IsInf(point[0], 0) || math.IsInf(point[1], 0) || point[0] < -180 || point[0] > 180 || point[1] < -90 || point[1] > 90 {
				return false
			}
		}
		first, last := ring[0], ring[len(ring)-1]
		if first[0] != last[0] || first[1] != last[1] {
			return false
		}
	}
	return true
}

// UpdateGeofence updates a geofence for a parking spot (admin)
func (h *AdminHandler) UpdateGeofence(c *gin.Context) {
	// Same as CreateGeofence since we're using UPDATE
	h.CreateGeofence(c)
}

// DeleteGeofence deletes a geofence for a parking spot (admin)
func (h *AdminHandler) DeleteGeofence(c *gin.Context) {
	spotID := c.Param("id")

	id, err := uuid.Parse(spotID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid spot ID"})
		return
	}

	query := `
		UPDATE parking_spots
		SET geofence = NULL
		WHERE id = $1
	`

	_, err = h.db.Exec(query, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete geofence"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Geofence deleted successfully"})
}

// GetAllEnforcementAlerts returns all enforcement alerts (admin only)
func (h *AdminHandler) GetAllEnforcementAlerts(c *gin.Context) {
	limit, offset, ok := parsePagination(c, 100, 200)
	if !ok {
		return
	}
	var alerts []models.EnforcementAlert

	query := `
		SELECT id, reporter_id, latitude, longitude, address, street_name,
		       enforcement_type, description, severity, status, verified_by_count,
		       flagged_count, created_at, expires_at, resolved_at
		FROM enforcement_alerts
		ORDER BY created_at DESC
		LIMIT $1 OFFSET $2
	`

	err := h.db.SelectContext(c.Request.Context(), &alerts, query, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch enforcement alerts"})
		return
	}

	c.JSON(http.StatusOK, alerts)
}

// Helper function to get schedules for a parking spot
func (h *AdminHandler) getSchedulesForSpot(spotID uuid.UUID) ([]models.EnforcementSchedule, error) {
	var schedules []models.EnforcementSchedule
	query := `
		SELECT id, parking_spot_id, day_of_week, start_time, end_time, schedule_type, description, created_at
		FROM enforcement_schedules
		WHERE parking_spot_id = $1
		ORDER BY day_of_week, start_time
	`
	err := h.db.Select(&schedules, query, spotID)
	if err != nil {
		return nil, err
	}
	return schedules, nil
}
