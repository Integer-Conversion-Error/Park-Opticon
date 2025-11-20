package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/auth"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/config"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/models"
)

type AuthHandler struct {
	db  *sqlx.DB
	cfg *config.Config
}

func NewAuthHandler(db *sqlx.DB, cfg *config.Config) *AuthHandler {
	return &AuthHandler{db: db, cfg: cfg}
}

type RegisterRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8"`
	Username string `json:"username" binding:"required,min=3,max=50"`
	FullName string `json:"full_name"`
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type AuthResponse struct {
	AccessToken  string       `json:"access_token"`
	RefreshToken string       `json:"refresh_token"`
	User         *models.User `json:"user"`
}

// Register creates a new user account
func (h *AuthHandler) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if email already exists
	var exists bool
	err := h.db.Get(&exists, "SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)", req.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	if exists {
		c.JSON(http.StatusConflict, gin.H{"error": "Email already registered"})
		return
	}

	// Check if username already exists
	err = h.db.Get(&exists, "SELECT EXISTS(SELECT 1 FROM users WHERE username = $1)", req.Username)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	if exists {
		c.JSON(http.StatusConflict, gin.H{"error": "Username already taken"})
		return
	}

	// Hash password
	hashedPassword, err := auth.HashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	// Create user
	user := &models.User{}
	query := `
		INSERT INTO users (email, password_hash, username, full_name)
		VALUES ($1, $2, $3, $4)
		RETURNING id, email, username, full_name, karma_points, notifications_enabled,
		          enforcement_alerts_enabled, parking_radius_miles, email_verified,
		          is_active, is_admin, created_at, updated_at
	`
	err = h.db.QueryRowx(query, req.Email, hashedPassword, req.Username, req.FullName).StructScan(user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
		return
	}

	// Generate tokens
	accessToken, err := auth.GenerateAccessToken(
		user.ID, user.Email, user.Username, user.IsAdmin,
		h.cfg.JWT.Secret, h.cfg.JWT.AccessExpiry,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate access token"})
		return
	}

	refreshToken, err := auth.GenerateRefreshToken(user.ID, h.cfg.JWT.Secret, h.cfg.JWT.RefreshExpiry)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate refresh token"})
		return
	}

	// Store refresh token in database
	_, err = h.db.Exec(`
		INSERT INTO user_sessions (user_id, refresh_token, expires_at, ip_address, device_info)
		VALUES ($1, $2, $3, $4, $5)
	`, user.ID, refreshToken, time.Now().Add(h.cfg.JWT.RefreshExpiry), c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to store session"})
		return
	}

	c.JSON(http.StatusCreated, AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User:         user,
	})
}

// Login authenticates a user
func (h *AuthHandler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get user from database
	var user models.User
	query := `
		SELECT id, email, password_hash, username, full_name, karma_points, 
		       notifications_enabled, enforcement_alerts_enabled, parking_radius_miles,
		       email_verified, is_active, is_admin, created_at, updated_at
		FROM users WHERE email = $1
	`
	err := h.db.Get(&user, query, req.Email)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	// Check if account is active
	if !user.IsActive {
		c.JSON(http.StatusForbidden, gin.H{"error": "Account is inactive"})
		return
	}

	// Verify password
	if err := auth.CheckPassword(req.Password, user.Password); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	// Update last login time
	_, err = h.db.Exec("UPDATE users SET last_login_at = $1 WHERE id = $2", time.Now(), user.ID)
	if err != nil {
		// Log error but don't fail the login
	}

	// Generate tokens
	accessToken, err := auth.GenerateAccessToken(
		user.ID, user.Email, user.Username, user.IsAdmin,
		h.cfg.JWT.Secret, h.cfg.JWT.AccessExpiry,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate access token"})
		return
	}

	refreshToken, err := auth.GenerateRefreshToken(user.ID, h.cfg.JWT.Secret, h.cfg.JWT.RefreshExpiry)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate refresh token"})
		return
	}

	// Store refresh token
	_, err = h.db.Exec(`
		INSERT INTO user_sessions (user_id, refresh_token, expires_at, ip_address, device_info)
		VALUES ($1, $2, $3, $4, $5)
	`, user.ID, refreshToken, time.Now().Add(h.cfg.JWT.RefreshExpiry), c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to store session"})
		return
	}

	// Clear password from response
	user.Password = ""

	c.JSON(http.StatusOK, AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User:         &user,
	})
}

// GetProfile returns the current user's profile
func (h *AuthHandler) GetProfile(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	var user models.User
	query := `
		SELECT id, email, username, full_name, phone_number, avatar_url, bio,
		       karma_points, notifications_enabled, enforcement_alerts_enabled,
		       parking_radius_miles, email_verified, is_active, is_admin,
		       created_at, updated_at, last_login_at
		FROM users WHERE id = $1
	`
	err := h.db.Get(&user, query, userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	c.JSON(http.StatusOK, user)
}
