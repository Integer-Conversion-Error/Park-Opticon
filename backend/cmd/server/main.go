package main

import (
	"flag"
	"fmt"
	"log"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/config"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/database"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/mockrouter"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/router"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/worker"
)

func main() {
	// Parse command line flags
	mockMode := flag.Bool("mock", false, "Run in mock mode with test data (no database required)")
	flag.Parse()

	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	// Load configuration
	cfg := config.Load()

	// Set Gin mode
	if cfg.Server.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	var r *gin.Engine

	if *mockMode {
		// ========== MOCK MODE ==========
		log.Println("🧪 Starting in MOCK MODE - Serving immutable test data")
		log.Println("📝 No database connection required")
		log.Println("⚠️  All changes are temporary and will not be persisted")
		
		// Initialize mock router (no database needed)
		r = mockrouter.Setup(cfg)

		log.Println("✅ Mock handlers initialized")
		log.Println("📊 Mock data loaded:")
		log.Println("   - Users: 2")
		log.Println("   - Parking Spots: 4")
		log.Println("   - Enforcement Alerts: 3")
		log.Println("   - Vehicles: 2")
		log.Println("   - Parking Sessions: 1")
		log.Println("   - Tickets: 2")

	} else {
		// ========== FULL MODE ==========
		log.Println("🚀 Starting in FULL MODE - Database-backed operation")

		// Initialize database
		db, err := database.New(cfg.Database)
		if err != nil {
			log.Fatalf("❌ Failed to connect to database: %v", err)
		}
		defer db.Close()

		log.Println("✅ Database connected successfully")

		// Run migrations
		if err := database.RunMigrations(db, cfg.Database); err != nil {
			log.Fatalf("❌ Failed to run migrations: %v", err)
		}

		log.Println("✅ Database migrations completed")

		// Initialize router with database
		r = router.Setup(db, cfg)

		// Start background workers
		alertWorker := worker.NewAlertChecker(db, cfg)
		go alertWorker.Start()
		log.Println("✅ Background alert checker started")

		expiryWorker := worker.NewExpiryChecker(db)
		go expiryWorker.Start()
		log.Println("✅ Background expiry checker started")
	}

	// Start server
	addr := fmt.Sprintf(":%s", cfg.Server.Port)
	mode := "FULL"
	if *mockMode {
		mode = "MOCK"
	}
	
	log.Printf("🌐 Server starting on %s (MODE: %s, ENV: %s)", addr, mode, cfg.Server.Env)
	log.Printf("📍 Health check: http://localhost%s/health", addr)
	log.Printf("📍 API docs: http://localhost%s/api/v1/", addr)

	if err := r.Run(addr); err != nil {
		log.Fatalf("❌ Failed to start server: %v", err)
	}
}
