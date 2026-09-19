package handlers

import (
	"database/sql"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/auth"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/config"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/database"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/models"
)

type AuthHandler struct {
	db   *sqlx.DB
	cfg  *config.Config
	oidc *auth.OIDCVerifier
}

func NewAuthHandler(db *sqlx.DB, cfg *config.Config) *AuthHandler {
	return &AuthHandler{
		db:  db,
		cfg: cfg,
		oidc: auth.NewOIDCVerifier(
			cfg.OAuth.GoogleClientIDs,
			cfg.OAuth.AppleClientIDs,
			cfg.OAuth.JWKSCacheTTL,
		),
	}
}

type RegisterRequest struct {
	Email    string `json:"email" binding:"required,email,max=255"`
	Password string `json:"password" binding:"required,min=8,max=72"`
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

type RefreshRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

type LogoutRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type UpdatePushTokenRequest struct {
	PushToken *string `json:"push_token"`
}

// Register creates a new user account
func (h *AuthHandler) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.Username = strings.TrimSpace(req.Username)
	if len([]rune(req.Username)) < 3 || len([]rune(req.Username)) > 50 || strings.ContainsAny(req.Username, " <>/\\\t\r\n") {
		Error(c, http.StatusBadRequest, "invalid_username", "Username must be 3–50 characters and cannot contain whitespace or path separators")
		return
	}

	// Check if email already exists
	var exists bool
	err := h.db.GetContext(c.Request.Context(), &exists, "SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)", req.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	if exists {
		Error(c, http.StatusConflict, "account_conflict", "Unable to create an account with those details")
		return
	}

	// Check if username already exists
	err = h.db.GetContext(c.Request.Context(), &exists, "SELECT EXISTS(SELECT 1 FROM users WHERE username = $1)", req.Username)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	if exists {
		Error(c, http.StatusConflict, "account_conflict", "Unable to create an account with those details")
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
		          enforcement_alerts_enabled, parking_radius_miles,
		          notification_radius_meters, ask_about_enforcement_after_parking,
		          announce_open_spot_after_unparking, email_verified,
		          is_active, is_admin, mfa_enabled, created_at, updated_at
	`
	err = h.db.QueryRowxContext(c.Request.Context(), query, req.Email, hashedPassword, req.Username, req.FullName).StructScan(user)
	if err != nil {
		if database.IsUniqueViolation(err) {
			Error(c, http.StatusConflict, "account_conflict", "Unable to create an account with those details")
			return
		}
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
	if err = h.storeRefreshSession(c, user.ID, refreshToken); err != nil {
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
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	// Get user from database
	var user models.User
	query := `
		SELECT id, email, password_hash, username, full_name, karma_points, 
		       notifications_enabled, enforcement_alerts_enabled, parking_radius_miles,
		       notification_radius_meters, ask_about_enforcement_after_parking,
		       announce_open_spot_after_unparking,
		       email_verified, is_active, is_admin, mfa_enabled, created_at, updated_at
		FROM users WHERE email = $1
	`
	err := h.db.GetContext(c.Request.Context(), &user, query, req.Email)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	// Check if account is active
	if !user.IsActive {
		Error(c, http.StatusUnauthorized, "invalid_credentials", "Invalid email or password")
		return
	}

	// Verify password
	if user.Password == nil || auth.CheckPassword(req.Password, *user.Password) != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}
	if auth.NeedsPasswordRehash(*user.Password) {
		if upgraded, hashErr := auth.HashPassword(req.Password); hashErr == nil {
			_, _ = h.db.ExecContext(c.Request.Context(), `UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, upgraded, user.ID)
		}
	}

	// Update last login time
	_, err = h.db.ExecContext(c.Request.Context(), "UPDATE users SET last_login_at = $1 WHERE id = $2", time.Now().UTC(), user.ID)
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
	if err = h.storeRefreshSession(c, user.ID, refreshToken); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to store session"})
		return
	}

	// Clear password from response
	user.Password = nil

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
		       parking_radius_miles, notification_radius_meters,
		       ask_about_enforcement_after_parking,
		       announce_open_spot_after_unparking,
		       email_verified, is_active, is_admin, mfa_enabled,
		       created_at, updated_at, last_login_at
		FROM users WHERE id = $1 AND is_active = true
	`
	err := h.db.GetContext(c.Request.Context(), &user, query, userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	c.JSON(http.StatusOK, user)
}

// GetCommunityImpact returns transparent, user-scoped contribution metrics.
// It intentionally avoids turning limited community feedback into a synthetic
// "trust score". A confirmation means at least one other driver currently
// confirms the original report; the alert count is unique recipient accounts,
// not device-delivery or read receipts.
func (h *AuthHandler) GetCommunityImpact(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	var impact models.CommunityImpact
	err := h.db.GetContext(c.Request.Context(), &impact, `
		WITH own_reports AS MATERIALIZED (
			SELECT id, 'parking_spot'::text AS report_type
			FROM parking_spots
			WHERE reporter_id = $1
			UNION ALL
			SELECT id, 'enforcement_alert'::text AS report_type
			FROM enforcement_alerts
			WHERE reporter_id = $1
		),
		own_enforcement_alerts AS MATERIALIZED (
			SELECT id
			FROM enforcement_alerts
			WHERE reporter_id = $1
		)
		SELECT
			(SELECT COUNT(*) FROM own_reports)::INTEGER AS reports_shared,
			(SELECT COUNT(*) FROM own_reports WHERE report_type = 'parking_spot')::INTEGER
				AS open_spots_shared,
			(SELECT COUNT(*) FROM own_reports WHERE report_type = 'enforcement_alert')::INTEGER
				AS enforcement_alerts_reported,
			(
				SELECT COUNT(*)
				FROM own_reports reports
				WHERE EXISTS (
					SELECT 1
					FROM verifications
					WHERE verifiable_type = reports.report_type
					  AND verifiable_id = reports.id
					  AND verification_type = 'confirm'
					  AND user_id <> $1
				)
			)::INTEGER AS reports_confirmed,
			(SELECT COUNT(*) FROM verifications WHERE user_id = $1)::INTEGER AS reports_checked,
			(
				SELECT COUNT(*)
				FROM verifications
				WHERE user_id = $1 AND verification_type = 'confirm'
			)::INTEGER AS confirmations_given,
			(
				SELECT COUNT(*)
				FROM verifications
				WHERE user_id = $1 AND verification_type = 'deny'
			)::INTEGER AS corrections_given,
			(
				SELECT COUNT(DISTINCT notifications.user_id)
				FROM own_enforcement_alerts alerts
				JOIN notifications ON notifications.related_id = alerts.id
				WHERE notifications.notification_type = 'enforcement_alert'
				  AND notifications.related_type = 'enforcement_alert'
				  AND notifications.user_id <> $1
			)::INTEGER AS drivers_alerted
	`, userID)
	if err != nil {
		Error(c, http.StatusInternalServerError, "community_impact_unavailable", "Unable to load community impact")
		return
	}

	c.JSON(http.StatusOK, impact)
}

// Refresh rotates a refresh token and issues a new access token. Refresh
// tokens are stored server-side so a user can revoke a device session.
func (h *AuthHandler) Refresh(c *gin.Context) {
	var req RefreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	claims, err := auth.ValidateToken(req.RefreshToken, h.cfg.JWT.Secret)
	if err != nil || claims.TokenType != "refresh" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired refresh token"})
		return
	}

	tx, err := h.db.BeginTxx(c.Request.Context(), nil)
	if err != nil {
		Error(c, http.StatusInternalServerError, "refresh_unavailable", "Unable to rotate session")
		return
	}
	defer tx.Rollback()

	var session struct {
		ID            uuid.UUID `db:"id"`
		UserID        uuid.UUID `db:"user_id"`
		Email         string    `db:"email"`
		Username      string    `db:"username"`
		IsAdmin       bool      `db:"is_admin"`
		TokenFamilyID uuid.UUID `db:"token_family_id"`
	}
	err = tx.GetContext(c.Request.Context(), &session, `
		SELECT s.id, s.user_id, s.token_family_id, u.email, u.username, u.is_admin
		FROM user_sessions s
		JOIN users u ON u.id = s.user_id
		WHERE s.user_id = $1
		  AND s.refresh_token_hash = $2
		  AND s.revoked_at IS NULL
		  AND s.expires_at > CURRENT_TIMESTAMP
		  AND u.is_active = true
		FOR UPDATE
	`, claims.UserID, auth.HashToken(req.RefreshToken))
	if err == sql.ErrNoRows {
		// A previously rotated token is a reuse signal. Revoke its entire
		// family before returning the same generic response.
		var familyID uuid.UUID
		if familyErr := tx.GetContext(c.Request.Context(), &familyID, `
			SELECT token_family_id FROM user_sessions WHERE refresh_token_hash = $1
		`, auth.HashToken(req.RefreshToken)); familyErr == nil {
			_, _ = tx.ExecContext(c.Request.Context(), `
				UPDATE user_sessions SET revoked_at = CURRENT_TIMESTAMP
				WHERE token_family_id = $1 AND revoked_at IS NULL
			`, familyID)
		}
		_ = tx.Commit()
		Error(c, http.StatusUnauthorized, "refresh_invalid", "Invalid or expired refresh token")
		return
	}
	if err != nil {
		Error(c, http.StatusInternalServerError, "refresh_failed", "Unable to load refresh session")
		return
	}

	accessToken, err := auth.GenerateAccessToken(
		session.UserID, session.Email, session.Username, session.IsAdmin,
		h.cfg.JWT.Secret, h.cfg.JWT.AccessExpiry,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate access token"})
		return
	}
	refreshToken, err := auth.GenerateRefreshToken(session.UserID, h.cfg.JWT.Secret, h.cfg.JWT.RefreshExpiry)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate refresh token"})
		return
	}

	var newSessionID uuid.UUID
	if err := tx.GetContext(c.Request.Context(), &newSessionID, `
		INSERT INTO user_sessions (
			user_id, refresh_token_hash, token_family_id, expires_at, ip_address, device_info
		)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id
	`, session.UserID, auth.HashToken(refreshToken), session.TokenFamilyID,
		time.Now().UTC().Add(h.cfg.JWT.RefreshExpiry), c.ClientIP(), c.Request.UserAgent()); err != nil {
		Error(c, http.StatusInternalServerError, "refresh_failed", "Unable to store rotated session")
		return
	}
	if _, err := tx.ExecContext(c.Request.Context(), `
		UPDATE user_sessions
		SET revoked_at = CURRENT_TIMESTAMP, last_used_at = CURRENT_TIMESTAMP,
		    replaced_by_session_id = $1
		WHERE id = $2 AND revoked_at IS NULL
	`, newSessionID, session.ID); err != nil {
		Error(c, http.StatusInternalServerError, "refresh_failed", "Unable to revoke previous session")
		return
	}
	if err := tx.Commit(); err != nil {
		Error(c, http.StatusInternalServerError, "refresh_failed", "Unable to commit refreshed session")
		return
	}

	c.JSON(http.StatusOK, AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
	})
}

func (h *AuthHandler) Logout(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	var req LogoutRequest
	if c.Request.ContentLength > 0 {
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
	}

	query := `
		UPDATE user_sessions
		SET revoked_at = CURRENT_TIMESTAMP, last_used_at = CURRENT_TIMESTAMP
		WHERE user_id = $1 AND revoked_at IS NULL`
	args := []interface{}{userID}
	if strings.TrimSpace(req.RefreshToken) != "" {
		query += " AND refresh_token_hash = $2"
		args = append(args, auth.HashToken(req.RefreshToken))
	}
	if _, err := h.db.ExecContext(c.Request.Context(), query, args...); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to log out"})
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *AuthHandler) storeRefreshSession(c *gin.Context, userID uuid.UUID, refreshToken string) error {
	_, err := h.db.ExecContext(c.Request.Context(), `
		INSERT INTO user_sessions (
			user_id, refresh_token_hash, token_family_id, expires_at, ip_address, device_info
		)
		VALUES ($1, $2, gen_random_uuid(), $3, $4, $5)
	`, userID, auth.HashToken(refreshToken), time.Now().UTC().Add(h.cfg.JWT.RefreshExpiry), c.ClientIP(), c.Request.UserAgent())
	return err
}

func (h *AuthHandler) UpdatePushToken(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	var req UpdatePushTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	pushToken := ""
	if req.PushToken != nil {
		pushToken = strings.TrimSpace(*req.PushToken)
	}
	if len(pushToken) > 4096 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "push_token is too long"})
		return
	}

	// The legacy users column remains synchronized for compatibility, while
	// user_devices lets one account receive alerts on more than one device.
	tx, err := h.db.BeginTxx(c.Request.Context(), nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start push-token transaction"})
		return
	}
	defer tx.Rollback()

	if pushToken == "" {
		if _, err = tx.ExecContext(c.Request.Context(), `
			UPDATE user_devices
			SET is_active = false, updated_at = CURRENT_TIMESTAMP
			WHERE user_id = $1 AND is_active = true
		`, userID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to clear push devices"})
			return
		}
		if _, err = tx.ExecContext(c.Request.Context(), `
			UPDATE users SET push_notification_token = NULL, updated_at = CURRENT_TIMESTAMP
			WHERE id = $1
		`, userID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to clear push token"})
			return
		}
	} else {
		if _, err = tx.ExecContext(c.Request.Context(), `
			INSERT INTO user_devices (user_id, push_token, is_active, last_seen_at, updated_at)
			VALUES ($1, $2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
			ON CONFLICT (push_token)
			DO UPDATE SET user_id = EXCLUDED.user_id,
			              is_active = true,
			              last_seen_at = CURRENT_TIMESTAMP,
			              updated_at = CURRENT_TIMESTAMP
		`, userID, pushToken); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to register push device"})
			return
		}
		if _, err = tx.ExecContext(c.Request.Context(), `
			UPDATE users SET push_notification_token = $1, updated_at = CURRENT_TIMESTAMP
			WHERE id = $2
		`, pushToken, userID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update push token"})
			return
		}
	}

	if err = tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update push token"})
		return
	}
	c.Status(http.StatusNoContent)
}
