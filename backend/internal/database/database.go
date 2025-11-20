package database

import (
	"fmt"

	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/config"
)

// New creates a new database connection
func New(cfg config.DatabaseConfig) (*sqlx.DB, error) {
	dsn := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		cfg.Host, cfg.Port, cfg.User, cfg.Password, cfg.Name, cfg.SSLMode,
	)

	db, err := sqlx.Connect("postgres", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	// Set connection pool settings
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)

	// Verify connection
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	// Enable PostGIS extension
	if _, err := db.Exec("CREATE EXTENSION IF NOT EXISTS postgis"); err != nil {
		return nil, fmt.Errorf("failed to enable PostGIS: %w", err)
	}

	return db, nil
}

// RunMigrations runs database migrations
func RunMigrations(db *sqlx.DB, cfg config.DatabaseConfig) error {
	// In production, use golang-migrate or similar
	// For now, we'll create tables directly

	migrations := []string{
		createUsersTable,
		createVehiclesTable,
		createParkingSpotsTable,
		createParkingSpotPhotosTable,
		createEnforcementAlertsTable,
		createEnforcementAlertPhotosTable,
		createParkingSessionsTable,
		createTicketsTable,
		createTicketPhotosTable,
		createVerificationsTable,
		createNotificationsTable,
		createUserSessionsTable,
		createAuditLogsTable,
		addParkingSpotPolygonColumns,
		addGeofenceTable,
		createParkingSpotTemplatesAndSchedules,
		fixScheduleTypeConstraint,
	}

	for _, migration := range migrations {
		if _, err := db.Exec(migration); err != nil {
			return fmt.Errorf("migration failed: %w", err)
		}
	}

	return nil
}
