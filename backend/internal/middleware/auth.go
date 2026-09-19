package middleware

import (
	"database/sql"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/auth"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/config"
)

// AuthMiddleware validates JWT tokens
func AuthMiddleware(cfg *config.Config, dbs ...*sqlx.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
			c.Abort()
			return
		}

		parts := strings.Fields(authHeader)
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid authorization header format"})
			c.Abort()
			return
		}

		claims, err := auth.ValidateToken(parts[1], cfg.JWT.Secret)
		if err != nil || claims.TokenType != "access" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			c.Abort()
			return
		}

		c.Set("user_id", claims.UserID)
		c.Set("email", claims.Email)
		c.Set("username", claims.Username)
		c.Set("is_admin", claims.IsAdmin)
		if claims.AdminMFAVerifiedAt != nil {
			c.Set("admin_mfa_verified_at", claims.AdminMFAVerifiedAt.Time.Format(time.RFC3339))
		}

		if len(dbs) == 0 || dbs[0] == nil {
			c.Next()
			return
		}

		var account struct {
			IsActive   bool `db:"is_active"`
			IsAdmin    bool `db:"is_admin"`
			MFAEnabled bool `db:"mfa_enabled"`
		}
		err = dbs[0].GetContext(c.Request.Context(), &account, `
			SELECT is_active, is_admin, COALESCE(mfa_enabled, false) AS mfa_enabled
			FROM users
			WHERE id = $1
		`, claims.UserID)
		if err == sql.ErrNoRows || !account.IsActive {
			Error(c, http.StatusUnauthorized, "account_inactive", "Invalid or expired token")
			c.Abort()
			return
		}
		if err != nil {
			Error(c, http.StatusServiceUnavailable, "auth_unavailable", "Authentication service unavailable")
			c.Abort()
			return
		}
		c.Set("is_admin", account.IsAdmin)
		c.Set("mfa_enabled", account.MFAEnabled)
		c.Set("live_auth", true)
		c.Next()
	}
}

// AdminMiddleware checks if user is an admin
func AdminMiddleware(stepUps ...time.Duration) gin.HandlerFunc {
	stepUpWindow := 10 * time.Minute
	if len(stepUps) > 0 && stepUps[0] > 0 {
		stepUpWindow = stepUps[0]
	}
	return func(c *gin.Context) {
		isAdmin, exists := c.Get("is_admin")
		isAdminValue, isAdminOK := isAdmin.(bool)
		if !exists || !isAdminOK || !isAdminValue {
			Error(c, http.StatusForbidden, "admin_required", "Admin access required")
			c.Abort()
			return
		}
		if live, ok := c.Get("live_auth"); ok && live == true {
			mfaEnabled, _ := c.Get("mfa_enabled")
			if enabled, ok := mfaEnabled.(bool); !ok || !enabled {
				Error(c, http.StatusPreconditionRequired, "admin_mfa_required", "Admin MFA enrollment is required")
				c.Abort()
				return
			}
			claimsAt := c.GetString("admin_mfa_verified_at")
			verifiedAt, err := time.Parse(time.RFC3339, claimsAt)
			if err != nil || time.Since(verifiedAt) > stepUpWindow {
				Error(c, http.StatusPreconditionRequired, "admin_step_up_required", "Recent admin MFA verification is required")
				c.Abort()
				return
			}
		}
		c.Next()
	}
}

// CORS middleware
func CORSMiddleware(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")

		// Check if origin is allowed
		allowed := false
		allowWildcard := false
		for _, allowedOrigin := range cfg.CORS.AllowedOrigins {
			if allowedOrigin == "*" {
				allowed = true
				allowWildcard = true
				break
			}
			if allowedOrigin == origin {
				allowed = true
				break
			}
		}

		if allowed {
			if allowWildcard {
				// Browsers reject wildcard origins together with credentials.
				// Reflect the concrete origin for development while keeping the
				// production path exact-origin based.
				if origin != "" {
					c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
					c.Writer.Header().Add("Vary", "Origin")
				}
			} else {
				c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
			}
		}

		if cfg.CORS.AllowCredentials {
			c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		}
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE, PATCH")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}
