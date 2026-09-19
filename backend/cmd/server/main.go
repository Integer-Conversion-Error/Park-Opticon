package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/config"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/database"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/mockrouter"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/router"
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
	if err := cfg.Validate(); err != nil {
		log.Fatalf("❌ Invalid configuration: %v", err)
	}

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

	server := &http.Server{
		Addr:           addr,
		Handler:        r,
		ReadTimeout:    cfg.Server.ReadTimeout,
		WriteTimeout:   cfg.Server.WriteTimeout,
		IdleTimeout:    cfg.Server.IdleTimeout,
		MaxHeaderBytes: 1 << 20,
	}
	serverErrors := make(chan error, 1)
	go func() { serverErrors <- server.ListenAndServe() }()

	shutdownSignal := make(chan os.Signal, 1)
	signal.Notify(shutdownSignal, syscall.SIGINT, syscall.SIGTERM)
	select {
	case err := <-serverErrors:
		if err != nil && err != http.ErrServerClosed {
			log.Fatalf("❌ Failed to start server: %v", err)
		}
	case <-shutdownSignal:
		shutdownContext, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := server.Shutdown(shutdownContext); err != nil {
			log.Printf("⚠️ Graceful shutdown failed: %v", err)
		}
	}
}
