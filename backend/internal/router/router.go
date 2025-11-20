package router

import (
	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/config"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/handlers"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/middleware"
)

func Setup(db *sqlx.DB, cfg *config.Config) *gin.Engine {
	r := gin.Default()

	// Global middleware
	r.Use(middleware.CORSMiddleware(cfg))

	// Initialize handlers
	authHandler := handlers.NewAuthHandler(db, cfg)
	parkingHandler := handlers.NewParkingHandler(db)
	enforcementHandler := handlers.NewEnforcementHandler(db)
	adminHandler := handlers.NewAdminHandler(db)
	templateHandler := handlers.NewTemplateHandler(db)

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status": "healthy",
			"time":   c.GetString("request_time"),
		})
	})

	// API v1 routes
	v1 := r.Group("/api/v1")
	{
		// Public routes
		auth := v1.Group("/auth")
		{
			auth.POST("/register", authHandler.Register)
			auth.POST("/login", authHandler.Login)
		}

		// Protected routes
		protected := v1.Group("")
		protected.Use(middleware.AuthMiddleware(cfg))
		{
			// User profile
			protected.GET("/profile", authHandler.GetProfile)

			// Parking spots
			parking := protected.Group("/parking-spots")
			{
				parking.POST("", parkingHandler.CreateParkingSpot)
				parking.GET("/nearby", parkingHandler.GetNearbyParkingSpots)
				parking.PATCH("/:id/taken", parkingHandler.MarkSpotTaken)
			}

			// Enforcement alerts
			enforcement := protected.Group("/enforcement-alerts")
			{
				enforcement.POST("", enforcementHandler.CreateEnforcementAlert)
				enforcement.GET("/nearby", enforcementHandler.GetNearbyEnforcementAlerts)
				enforcement.PATCH("/:id/resolve", enforcementHandler.ResolveEnforcementAlert)
			}

			// TODO: Add more routes for:
			// - Parking sessions (start/end session, get active session)
			// - Tickets (CRUD operations)
			// - Vehicles (CRUD operations)
			// - Photos (upload to S3)
			// - Verifications (verify/flag reports)
			// - Notifications (get user notifications, mark as read)

			// Admin routes
			admin := protected.Group("/admin")
			admin.Use(middleware.AdminMiddleware())
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
