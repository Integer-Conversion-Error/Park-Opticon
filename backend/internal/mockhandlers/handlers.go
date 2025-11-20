package mockhandlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/auth"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/config"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/mockdata"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/models"
)

type MockHandlers struct {
	cfg *config.Config
}

func New(cfg *config.Config) *MockHandlers {
	return &MockHandlers{cfg: cfg}
}

// Health check
func (h *MockHandlers) Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":     "ok",
		"mode":       "mock",
		"message":    "Park-Opticon API (Mock Mode - Immutable Test Data)",
		"timestamp":  time.Now(),
		"database":   "inmemory",
		"users":      len(mockdata.MockUsers),
		"spots":      len(mockdata.MockParkingSpots),
		"alerts":     len(mockdata.MockEnforcementAlerts),
		"vehicles":   len(mockdata.MockVehicles),
		"sessions":   len(mockdata.MockParkingSessions),
		"tickets":    len(mockdata.MockTickets),
	})
}

// Auth endpoints
func (h *MockHandlers) Register(c *gin.Context) {
	var req struct {
		Email    string `json:"email" binding:"required,email"`
		Password string `json:"password" binding:"required,min=6"`
		Username string `json:"username" binding:"required"`
		FullName string `json:"full_name"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Return mock user
	user := mockdata.MockUsers[0]
	user.Email = req.Email
	user.Username = req.Username

	accessToken, _ := auth.GenerateAccessToken(user.ID, user.Email, user.Username, false, h.cfg.JWT.Secret, 15*time.Minute)
	refreshToken, _ := auth.GenerateRefreshToken(user.ID, h.cfg.JWT.Secret, 7*24*time.Hour)

	c.JSON(http.StatusCreated, gin.H{
		"message":       "User registered successfully (mock)",
		"user":          user,
		"access_token":  accessToken,
		"refresh_token": refreshToken,
	})
}

func (h *MockHandlers) Login(c *gin.Context) {
	var req struct {
		Email    string `json:"email" binding:"required,email"`
		Password string `json:"password" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if email matches mock users
	user := mockdata.GetMockUser(req.Email)
	if user == nil {
		// Default to first mock user
		user = &mockdata.MockUsers[0]
	}

	accessToken, _ := auth.GenerateAccessToken(user.ID, user.Email, user.Username, false, h.cfg.JWT.Secret, 15*time.Minute)
	refreshToken, _ := auth.GenerateRefreshToken(user.ID, h.cfg.JWT.Secret, 7*24*time.Hour)

	c.JSON(http.StatusOK, gin.H{
		"message":       "Login successful (mock)",
		"user":          user,
		"access_token":  accessToken,
		"refresh_token": refreshToken,
	})
}

func (h *MockHandlers) GetProfile(c *gin.Context) {
	userID, _ := c.Get("user_id")
	
	user := mockdata.GetMockUserByID(userID.(uuid.UUID))
	if user == nil {
		user = &mockdata.MockUsers[0]
	}

	c.JSON(http.StatusOK, gin.H{
		"user": user,
	})
}

// Parking spots endpoints
func (h *MockHandlers) GetNearbyParkingSpots(c *gin.Context) {
	// In mock mode, return all parking spots
	c.JSON(http.StatusOK, gin.H{
		"spots": mockdata.MockParkingSpots,
		"count": len(mockdata.MockParkingSpots),
	})
}

func (h *MockHandlers) ReportParkingSpot(c *gin.Context) {
	var req struct {
		Latitude         float64 `json:"latitude" binding:"required"`
		Longitude        float64 `json:"longitude" binding:"required"`
		Address          string  `json:"address"`
		StreetName       string  `json:"street_name"`
		SpotType         string  `json:"spot_type"`
		DurationEstimate int     `json:"duration_estimate"`
		Notes            string  `json:"notes"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Create a new spot based on input (but don't persist)
	spot := models.ParkingSpot{
		ID:               uuid.New(),
		Latitude:         req.Latitude,
		Longitude:        req.Longitude,
		Address:          &req.Address,
		StreetName:       &req.StreetName,
		SpotType:         &req.SpotType,
		DurationEstimate: &req.DurationEstimate,
		Notes:            &req.Notes,
		Status:           "available",
		VerifiedByCount:  0,
		FlaggedCount:     0,
		CreatedAt:        time.Now(),
		ExpiresAt:        func() *time.Time { t := time.Now().Add(2 * time.Hour); return &t }(),
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Parking spot reported (mock - not persisted)",
		"spot":    spot,
	})
}

func (h *MockHandlers) MarkSpotTaken(c *gin.Context) {
	spotID := c.Param("id")
	c.JSON(http.StatusOK, gin.H{
		"message": "Spot marked as taken (mock)",
		"spot_id": spotID,
	})
}

// Enforcement alerts endpoints
func (h *MockHandlers) GetNearbyEnforcementAlerts(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"alerts": mockdata.MockEnforcementAlerts,
		"count":  len(mockdata.MockEnforcementAlerts),
	})
}

func (h *MockHandlers) ReportEnforcementAlert(c *gin.Context) {
	var req struct {
		Latitude        float64 `json:"latitude" binding:"required"`
		Longitude       float64 `json:"longitude" binding:"required"`
		Address         string  `json:"address"`
		StreetName      string  `json:"street_name"`
		EnforcementType string  `json:"enforcement_type" binding:"required"`
		Description     string  `json:"description" binding:"required"`
		Severity        string  `json:"severity"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	alert := models.EnforcementAlert{
		ID:              uuid.New(),
		Latitude:        req.Latitude,
		Longitude:       req.Longitude,
		Address:         &req.Address,
		StreetName:      &req.StreetName,
		EnforcementType: req.EnforcementType,
		Description:     req.Description,
		Severity:        req.Severity,
		Status:          "active",
		VerifiedByCount: 0,
		FlaggedCount:    0,
		CreatedAt:       time.Now(),
		ExpiresAt:       time.Now().Add(30 * time.Minute),
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Enforcement alert reported (mock - not persisted)",
		"alert":   alert,
	})
}

func (h *MockHandlers) ResolveEnforcementAlert(c *gin.Context) {
	alertID := c.Param("id")
	c.JSON(http.StatusOK, gin.H{
		"message":  "Alert resolved (mock)",
		"alert_id": alertID,
	})
}

// Vehicle endpoints
func (h *MockHandlers) GetVehicles(c *gin.Context) {
	userID, _ := c.Get("user_id")
	
	// Filter vehicles by user
	var userVehicles []models.Vehicle
	for _, v := range mockdata.MockVehicles {
		if v.UserID == userID.(uuid.UUID) {
			userVehicles = append(userVehicles, v)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"vehicles": userVehicles,
		"count":    len(userVehicles),
	})
}

// Parking session endpoints
func (h *MockHandlers) GetParkingSessions(c *gin.Context) {
	userID, _ := c.Get("user_id")
	
	// Filter sessions by user
	var userSessions []models.ParkingSession
	for _, s := range mockdata.MockParkingSessions {
		if s.UserID == userID.(uuid.UUID) {
			userSessions = append(userSessions, s)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"sessions": userSessions,
		"count":    len(userSessions),
	})
}

// Ticket endpoints
func (h *MockHandlers) GetTickets(c *gin.Context) {
	userID, _ := c.Get("user_id")
	
	// Filter tickets by user
	var userTickets []models.Ticket
	for _, t := range mockdata.MockTickets {
		if t.UserID == userID.(uuid.UUID) {
			userTickets = append(userTickets, t)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"tickets": userTickets,
		"count":   len(userTickets),
	})
}
