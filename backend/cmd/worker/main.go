package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/joho/godotenv"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/config"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/database"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/worker"
)

// The worker is deliberately a separate process from the HTTP API. API
// replicas can now scale without multiplying alert scans or push senders.
func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	cfg := config.Load()
	if err := cfg.ValidateWorker(); err != nil {
		log.Fatalf("Invalid configuration: %v", err)
	}

	db, err := database.New(cfg.Database)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()
	if err := database.RunMigrations(db, cfg.Database); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	dispatcher := worker.NewAlertDispatcher(db, cfg)
	expiryChecker := worker.NewExpiryChecker(db, cfg)
	go dispatcher.Start(ctx)
	go expiryChecker.Start(ctx)

	log.Println("Alert worker started")
	<-ctx.Done()
	log.Println("Alert worker shutting down")
}
