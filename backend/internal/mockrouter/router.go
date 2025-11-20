package mockrouter

import (
	"github.com/gin-gonic/gin"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/config"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/middleware"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/mockhandlers"
)

func Setup(cfg *config.Config) *gin.Engine {
	r := gin.Default()

	// CORS middleware
	r.Use(middleware.CORSMiddleware(cfg))

	// Initialize mock handlers
	h := mockhandlers.New(cfg)

	// Health check (no auth required)
	r.GET("/health", h.Health)

	// API v1 routes
	v1 := r.Group("/api/v1")
	{
		// Public routes
		auth := v1.Group("/auth")
		{
			auth.POST("/register", h.Register)
			auth.POST("/login", h.Login)
		}

		// Protected routes (require JWT)
		protected := v1.Group("")
		protected.Use(middleware.AuthMiddleware(cfg))
		{
			// Profile
			protected.GET("/profile", h.GetProfile)

			// Parking spots
			spots := protected.Group("/parking-spots")
			{
				spots.GET("/nearby", h.GetNearbyParkingSpots)
				spots.POST("", h.ReportParkingSpot)
				spots.PATCH("/:id/taken", h.MarkSpotTaken)
			}

			// Enforcement alerts
			alerts := protected.Group("/enforcement-alerts")
			{
				alerts.GET("/nearby", h.GetNearbyEnforcementAlerts)
				alerts.POST("", h.ReportEnforcementAlert)
				alerts.PATCH("/:id/resolve", h.ResolveEnforcementAlert)
			}

			// Vehicles
			protected.GET("/vehicles", h.GetVehicles)

			// Parking sessions
			protected.GET("/parking-sessions", h.GetParkingSessions)

			// Tickets
			protected.GET("/tickets", h.GetTickets)

			// Admin routes
			admin := protected.Group("/admin")
			{
				// Users
				admin.GET("/users", h.GetAllUsers)

				// Parking spots - Full CRUD
				admin.GET("/parking-spots", h.GetAllParkingSpots)
				admin.GET("/parking-spots/:id", h.GetParkingSpotByID)
				admin.POST("/parking-spots", h.CreateParkingSpot)
				admin.PUT("/parking-spots/:id", h.UpdateParkingSpot)
				admin.DELETE("/parking-spots/:id", h.DeleteParkingSpot)
				
				// Geofencing
				admin.POST("/parking-spots/:id/geofence", h.CreateGeofence)
				admin.PUT("/parking-spots/:id/geofence", h.UpdateGeofence)
				admin.DELETE("/parking-spots/:id/geofence", h.DeleteGeofence)

				// Enforcement alerts
				admin.GET("/enforcement-alerts", h.GetAllEnforcementAlerts)
			}
		}
	}

	return r
}
