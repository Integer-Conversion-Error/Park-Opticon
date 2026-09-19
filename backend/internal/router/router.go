package router

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/config"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/handlers"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/middleware"
)

func Setup(db *sqlx.DB, cfg *config.Config) *gin.Engine {
	gin.EnableJsonDecoderDisallowUnknownFields()
	gin.EnableJsonDecoderUseNumber()
	r := gin.New()
	r.Use(gin.Recovery(), middleware.RequestSecurity(cfg), middleware.RequestLogger())
	// Do not trust forwarded client-IP headers unless a deployment explicitly
	// configures trusted proxy addresses.
	if err := r.SetTrustedProxies(cfg.Security.TrustedProxies); err != nil {
		panic(err)
	}

	// Global middleware
	r.Use(middleware.CORSMiddleware(cfg))

	// Initialize handlers
	authHandler := handlers.NewAuthHandler(db, cfg)
	parkingHandler := handlers.NewParkingHandler(db)
	parkingSessionHandler := handlers.NewParkingSessionHandler(db)
	enforcementHandler := handlers.NewEnforcementHandler(db)
	feedHandler := handlers.NewFeedHandler(db)
	preferencesHandler := handlers.NewPreferencesHandler(db)
	verificationHandler := handlers.NewVerificationHandler(db)
	notificationsHandler := handlers.NewNotificationsHandler(db)
	mfaHandler := handlers.NewMFAHandler(db, cfg)
	adminHandler := handlers.NewAdminHandler(db)
	templateHandler := handlers.NewTemplateHandler(db)

	// Health check
	healthHandler := func(c *gin.Context) {
		pingContext, cancel := context.WithTimeout(c.Request.Context(), time.Second)
		defer cancel()
		if err := db.PingContext(pingContext); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"status": "unhealthy", "time": time.Now().UTC()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "healthy", "time": time.Now().UTC()})
	}
	r.GET("/health", healthHandler)
	r.HEAD("/health", healthHandler)

	// API v1 routes
	v1 := r.Group("/api/v1")
	{
		// Public routes
		auth := v1.Group("/auth")
		{
			auth.POST("/register", authHandler.Register)
			auth.POST("/login", authHandler.Login)
			auth.POST("/refresh", authHandler.Refresh)
			auth.POST("/oauth/challenge", authHandler.CreateOAuthChallenge)
			auth.POST("/oauth/sign-in", authHandler.OAuthSignIn)
		}

		// Protected routes
		protected := v1.Group("")
		protected.Use(middleware.AuthMiddleware(cfg, db))
		{
			// User profile
			protected.GET("/profile", authHandler.GetProfile)
			protected.GET("/profile/community-impact", authHandler.GetCommunityImpact)
			protected.PATCH("/profile/push-token", authHandler.UpdatePushToken)
			protected.POST("/auth/logout", authHandler.Logout)
			protected.GET("/auth/identities", authHandler.ListOAuthIdentities)
			protected.POST("/auth/reauthenticate", authHandler.ReauthenticateForOAuthLink)
			protected.POST("/auth/identities", authHandler.LinkOAuthIdentity)
			protected.GET("/auth/mfa/status", mfaHandler.Status)
			protected.POST("/auth/mfa/enroll", mfaHandler.Enroll)
			protected.POST("/auth/mfa/confirm", mfaHandler.Confirm)
			protected.POST("/auth/mfa/verify", mfaHandler.Verify)
			protected.POST("/auth/mfa/disable", mfaHandler.Disable)
			protected.GET("/profile/preferences", preferencesHandler.Get)
			protected.PATCH("/profile/preferences", preferencesHandler.Update)

			// Combined map feed. Public report identities are intentionally
			// omitted from this response.
			protected.GET("/feed/nearby", feedHandler.Nearby)

			// Parking sessions
			parkingSessions := protected.Group("/parking-sessions")
			{
				parkingSessions.POST("", parkingSessionHandler.Create)
				parkingSessions.GET("/active", parkingSessionHandler.Active)
				parkingSessions.PATCH("/:id/end", parkingSessionHandler.End)
				parkingSessions.POST("/:id/feedback", parkingSessionHandler.SubmitFeedback)
			}

			// Parking spots
			parking := protected.Group("/parking-spots")
			{
				parking.GET("/nearby", parkingHandler.GetNearbyParkingSpots)
				parking.PATCH("/:id/taken", parkingHandler.MarkSpotTaken)
				parking.POST("/:id/verifications", verificationHandler.VerifyParkingSpot)
			}

			// Enforcement alerts
			enforcement := protected.Group("/enforcement-alerts")
			{
				enforcement.POST("", enforcementHandler.CreateEnforcementAlert)
				enforcement.GET("/nearby", enforcementHandler.GetNearbyEnforcementAlerts)
				enforcement.PATCH("/:id/resolve", enforcementHandler.ResolveEnforcementAlert)
				enforcement.POST("/:id/verifications", verificationHandler.VerifyEnforcementAlert)
			}

			// In-app notifications are user-scoped; no notification can be
			// read or marked by another account.
			notifications := protected.Group("/notifications")
			{
				notifications.GET("", notificationsHandler.List)
				notifications.PATCH("/:id/read", notificationsHandler.MarkRead)
				notifications.POST("/read-all", notificationsHandler.MarkAllRead)
			}

			// Admin routes
			admin := protected.Group("/admin")
			admin.Use(middleware.AdminMiddleware(cfg.JWT.AdminMFAStepUp))
			admin.Use(middleware.AdminAuditLogger(db))
			{
				// Users
				admin.GET("/users", adminHandler.GetAllUsers)

				// Parking spots
				admin.GET("/parking-spots", adminHandler.GetAllParkingSpots)
				admin.GET("/parking-spots/:id", adminHandler.GetParkingSpotByID)
				admin.POST("/parking-spots", adminHandler.CreateParkingSpot)
				admin.PUT("/parking-spots/:id", adminHandler.UpdateParkingSpot)
				admin.DELETE("/parking-spots/:id", adminHandler.DeleteParkingSpot)

				// Geofencing
				admin.POST("/parking-spots/:id/geofence", adminHandler.CreateGeofence)
				admin.PUT("/parking-spots/:id/geofence", adminHandler.UpdateGeofence)
				admin.DELETE("/parking-spots/:id/geofence", adminHandler.DeleteGeofence)

				// Parking Spot Templates
				admin.GET("/templates", templateHandler.GetAllTemplates)
				admin.GET("/templates/:id", templateHandler.GetTemplateByID)
				admin.POST("/templates", templateHandler.CreateTemplate)
				admin.PUT("/templates/:id", templateHandler.UpdateTemplate)
				admin.DELETE("/templates/:id", templateHandler.DeleteTemplate)

				// Enforcement alerts
				admin.GET("/enforcement-alerts", adminHandler.GetAllEnforcementAlerts)
			}
		}
	}

	return r
}
