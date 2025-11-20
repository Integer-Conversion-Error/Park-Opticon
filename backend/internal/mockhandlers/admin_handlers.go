package mockhandlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/mockdata"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/models"
)

// GetAllUsers returns all mock users
func (h *MockHandlers) GetAllUsers(c *gin.Context) {
	c.JSON(http.StatusOK, mockdata.MockUsers)
}

// GetAllParkingSpots returns all mock parking spots
func (h *MockHandlers) GetAllParkingSpots(c *gin.Context) {
	c.JSON(http.StatusOK, mockdata.MockParkingSpots)
}

// GetParkingSpotByID returns a single parking spot by ID
func (h *MockHandlers) GetParkingSpotByID(c *gin.Context) {
	spotID := c.Param("id")
	id, err := uuid.Parse(spotID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid spot ID"})
		return
	}

	for _, spot := range mockdata.MockParkingSpots {
		if spot.ID == id {
			c.JSON(http.StatusOK, spot)
			return
		}
	}

	c.JSON(http.StatusNotFound, gin.H{"error": "Parking spot not found"})
}

// CreateParkingSpot creates a new parking spot (mock - not persisted)
func (h *MockHandlers) CreateParkingSpot(c *gin.Context) {
	var req struct {
		Latitude         float64 `json:"latitude" binding:"required"`
		Longitude        float64 `json:"longitude" binding:"required"`
		Address          string  `json:"address"`
		StreetName       string  `json:"street_name"`
		SpotType         string  `json:"spot_type"`
		DurationEstimate int     `json:"duration_estimate"`
		Notes            string  `json:"notes"`
		Status           string  `json:"status"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Create new parking spot
	newSpot := models.ParkingSpot{
		ID:               uuid.New(),
		Latitude:         req.Latitude,
		Longitude:        req.Longitude,
		Address:          &req.Address,
		StreetName:       &req.StreetName,
		SpotType:         &req.SpotType,
		DurationEstimate: &req.DurationEstimate,
		Notes:            &req.Notes,
		Status:           req.Status,
		VerifiedByCount:  0,
		FlaggedCount:     0,
		CreatedAt:        time.Now(),
		ExpiresAt:        func() *time.Time { t := time.Now().Add(2 * time.Hour); return &t }(),
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Parking spot created (mock - not persisted)",
		"spot":    newSpot,
	})
}

// UpdateParkingSpot updates an existing parking spot (mock - not persisted)
func (h *MockHandlers) UpdateParkingSpot(c *gin.Context) {
	spotID := c.Param("id")
	id, err := uuid.Parse(spotID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid spot ID"})
		return
	}

	var req struct {
		Latitude         *float64 `json:"latitude"`
		Longitude        *float64 `json:"longitude"`
		Address          *string  `json:"address"`
		StreetName       *string  `json:"street_name"`
		SpotType         *string  `json:"spot_type"`
		DurationEstimate *int     `json:"duration_estimate"`
		Notes            *string  `json:"notes"`
		Status           *string  `json:"status"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Find the spot
	var updatedSpot *models.ParkingSpot
	for i, spot := range mockdata.MockParkingSpots {
		if spot.ID == id {
			updatedSpot = &mockdata.MockParkingSpots[i]
			break
		}
	}

	if updatedSpot == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Parking spot not found"})
		return
	}

	// Update fields if provided
	if req.Latitude != nil {
		updatedSpot.Latitude = *req.Latitude
	}
	if req.Longitude != nil {
		updatedSpot.Longitude = *req.Longitude
	}
	if req.Address != nil {
		updatedSpot.Address = req.Address
	}
	if req.StreetName != nil {
		updatedSpot.StreetName = req.StreetName
	}
	if req.SpotType != nil {
		updatedSpot.SpotType = req.SpotType
	}
	if req.DurationEstimate != nil {
		updatedSpot.DurationEstimate = req.DurationEstimate
	}
	if req.Notes != nil {
		updatedSpot.Notes = req.Notes
	}
	if req.Status != nil {
		updatedSpot.Status = *req.Status
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Parking spot updated (mock - not persisted)",
		"spot":    updatedSpot,
	})
}

// DeleteParkingSpot deletes a parking spot (mock - not persisted)
func (h *MockHandlers) DeleteParkingSpot(c *gin.Context) {
	spotID := c.Param("id")
	id, err := uuid.Parse(spotID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid spot ID"})
		return
	}

	// Check if spot exists
	found := false
	for _, spot := range mockdata.MockParkingSpots {
		if spot.ID == id {
			found = true
			break
		}
	}

	if !found {
		c.JSON(http.StatusNotFound, gin.H{"error": "Parking spot not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Parking spot deleted (mock - not persisted)",
		"spot_id": spotID,
	})
}

// GetAllEnforcementAlerts returns all mock enforcement alerts
func (h *MockHandlers) GetAllEnforcementAlerts(c *gin.Context) {
	c.JSON(http.StatusOK, mockdata.MockEnforcementAlerts)
}

// CreateGeofence mock handler for creating a geofence
func (h *MockHandlers) CreateGeofence(c *gin.Context) {
	spotID := c.Param("id")
	var req struct {
		Polygon [][][]float64 `json:"polygon"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Geofence created (mock - not persisted)",
		"spot_id": spotID,
	})
}

// UpdateGeofence mock handler for updating a geofence
func (h *MockHandlers) UpdateGeofence(c *gin.Context) {
	spotID := c.Param("id")
	var req struct {
		Polygon [][][]float64 `json:"polygon"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Geofence updated (mock - not persisted)",
		"spot_id": spotID,
	})
}

// DeleteGeofence mock handler for deleting a geofence
func (h *MockHandlers) DeleteGeofence(c *gin.Context) {
	spotID := c.Param("id")
	c.JSON(http.StatusOK, gin.H{
		"message": "Geofence deleted (mock - not persisted)",
		"spot_id": spotID,
	})
}
