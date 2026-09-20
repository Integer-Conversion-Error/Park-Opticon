package database

import (
	"context"
	"database/sql"
	"fmt"
	"net"
	"net/url"
	"strconv"
	"time"

	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/config"
)

type schemaMigration struct {
	Version int
	Name    string
	SQL     string
}

const createSchemaMigrationsTable = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`

// New creates a new database connection
func New(cfg config.DatabaseConfig) (*sqlx.DB, error) {
	connectTimeout := cfg.ConnectTimeout
	if connectTimeout <= 0 {
		connectTimeout = 5 * time.Second
	}
	statementTimeout := cfg.StatementTimeout
	if statementTimeout <= 0 {
		statementTimeout = 5 * time.Second
	}
	maxOpenConns := cfg.MaxOpenConns
	if maxOpenConns <= 0 {
		maxOpenConns = 20
	}
	maxIdleConns := cfg.MaxIdleConns
	if maxIdleConns <= 0 {
		maxIdleConns = minInt(5, maxOpenConns)
	}
	query := url.Values{
		"sslmode":         []string{cfg.SSLMode},
		"connect_timeout": []string{strconv.Itoa(maxInt(1, int(connectTimeout.Seconds())))},
		"options":         []string{fmt.Sprintf("-c statement_timeout=%s", statementTimeout)},
	}
	if cfg.SSLRootCert != "" {
		query.Set("sslrootcert", cfg.SSLRootCert)
	}
	dsnURL := &url.URL{
		Scheme:   "postgres",
		User:     url.UserPassword(cfg.User, cfg.Password),
		Host:     net.JoinHostPort(cfg.Host, cfg.Port),
		Path:     "/" + cfg.Name,
		RawQuery: query.Encode(),
	}

	connectContext, cancel := context.WithTimeout(context.Background(), connectTimeout)
	defer cancel()
	db, err := sqlx.ConnectContext(connectContext, "postgres", dsnURL.String())
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	// Keep a bounded pool. Supabase's pooler can sit behind this same interface
	// later without changing repositories or handlers.
	db.SetMaxOpenConns(maxOpenConns)
	db.SetMaxIdleConns(minInt(maxIdleConns, maxOpenConns))
	db.SetConnMaxLifetime(cfg.ConnMaxLifetime)
	db.SetConnMaxIdleTime(cfg.ConnMaxIdleTime)

	pingContext, pingCancel := context.WithTimeout(context.Background(), connectTimeout)
	defer pingCancel()
	if err := db.PingContext(pingContext); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return db, nil
}

func maxInt(left, right int) int {
	if left > right {
		return left
	}
	return right
}

func minInt(left, right int) int {
	if left < right {
		return left
	}
	return right
}

// RunMigrations applies the runtime migration list exactly once and records it
// in schema_migrations. The transaction-level advisory lock prevents two
// server instances from applying the same migration concurrently. The Go list
// below is the authoritative path used by the server; backend/migrations/*.sql
// remains a fresh-install bootstrap for the standalone init script.
func RunMigrations(db *sqlx.DB, _ config.DatabaseConfig) error {
	// schema_migrations itself must be created before the transaction-level
	// migration lock can be used. Create it inside a short bootstrap transaction
	// guarded by a separate advisory lock so an API and worker starting together
	// cannot race while PostgreSQL creates the table's row type.
	ctx := context.Background()
	bootstrapTx, err := db.BeginTxx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin migration bootstrap: %w", err)
	}
	defer bootstrapTx.Rollback()
	if _, err := bootstrapTx.ExecContext(ctx, `SELECT pg_advisory_xact_lock(hashtext('parkopticon_schema_migrations_bootstrap')::bigint)`); err != nil {
		return fmt.Errorf("lock migration bootstrap: %w", err)
	}
	if _, err := bootstrapTx.ExecContext(ctx, createSchemaMigrationsTable); err != nil {
		return fmt.Errorf("create schema_migrations table: %w", err)
	}
	if err := bootstrapTx.Commit(); err != nil {
		return fmt.Errorf("commit migration bootstrap: %w", err)
	}

	migrations := []schemaMigration{
		{Version: 0, Name: "enable_required_extensions", SQL: enableRequiredExtensions},
		{Version: 1, Name: "create_users", SQL: createUsersTable},
		{Version: 2, Name: "create_vehicles", SQL: createVehiclesTable},
		{Version: 3, Name: "create_parking_spots", SQL: createParkingSpotsTable},
		{Version: 4, Name: "create_parking_spot_photos", SQL: createParkingSpotPhotosTable},
		{Version: 5, Name: "create_enforcement_alerts", SQL: createEnforcementAlertsTable},
		{Version: 6, Name: "create_enforcement_alert_photos", SQL: createEnforcementAlertPhotosTable},
		{Version: 7, Name: "create_parking_sessions", SQL: createParkingSessionsTable},
		{Version: 8, Name: "create_tickets", SQL: createTicketsTable},
		{Version: 9, Name: "create_ticket_photos", SQL: createTicketPhotosTable},
		{Version: 10, Name: "create_verifications", SQL: createVerificationsTable},
		{Version: 11, Name: "create_notifications", SQL: createNotificationsTable},
		{Version: 12, Name: "create_user_sessions", SQL: createUserSessionsTable},
		{Version: 13, Name: "create_audit_logs", SQL: createAuditLogsTable},
		{Version: 14, Name: "add_parking_spot_polygon_columns", SQL: addParkingSpotPolygonColumns},
		{Version: 15, Name: "add_geofence_table", SQL: addGeofenceTable},
		{Version: 16, Name: "create_parking_templates_and_schedules", SQL: createParkingSpotTemplatesAndSchedules},
		{Version: 17, Name: "fix_schedule_type_constraint", SQL: fixScheduleTypeConstraint},
		{Version: 18, Name: "harden_core_integrity", SQL: hardenCoreIntegrity},
		{Version: 19, Name: "add_mobile_report_lifecycle", SQL: addMobileReportLifecycle},
		{Version: 20, Name: "security_hardening", SQL: securityHardening},
		{Version: 21, Name: "purge_legacy_refresh_tokens", SQL: purgeLegacyRefreshTokens},
		{Version: 22, Name: "normalize_geofence_type", SQL: normalizeGeofenceType},
		{Version: 23, Name: "add_alert_delivery_pipeline", SQL: addAlertDeliveryPipeline},
		{Version: 24, Name: "expand_notification_radius", SQL: expandNotificationRadius},
		{Version: 25, Name: "add_community_impact_indexes", SQL: addCommunityImpactIndexes},
		{Version: 26, Name: "add_oauth_identities", SQL: addOAuthIdentities},
		{Version: 27, Name: "add_oauth_link_reauthentication", SQL: addOAuthLinkReauthentication},
		{Version: 28, Name: "limit_notification_radius", SQL: limitNotificationRadius},
	}

	for _, migration := range migrations {
		if err := applyMigration(db, migration); err != nil {
			return err
		}
	}

	return nil
}

func applyMigration(db *sqlx.DB, migration schemaMigration) error {
	tx, err := db.Beginx()
	if err != nil {
		return fmt.Errorf("begin migration %03d_%s: %w", migration.Version, migration.Name, err)
	}

	rollback := func(cause error) error {
		_ = tx.Rollback()
		return cause
	}

	if _, err := tx.Exec(`SELECT pg_advisory_xact_lock(hashtext('parkopticon_schema_migrations')::bigint)`); err != nil {
		return rollback(fmt.Errorf("lock migration %03d_%s: %w", migration.Version, migration.Name, err))
	}

	var appliedName string
	err = tx.Get(&appliedName, `
		SELECT name
		FROM schema_migrations
		WHERE version = $1
	`, migration.Version)
	if err == nil {
		if appliedName != migration.Name {
			return rollback(fmt.Errorf(
				"migration version %d is recorded as %q, expected %q",
				migration.Version, appliedName, migration.Name,
			))
		}
		if err := tx.Commit(); err != nil {
			return fmt.Errorf("commit recorded migration %03d_%s: %w", migration.Version, migration.Name, err)
		}
		return nil
	}
	if err != sql.ErrNoRows {
		return rollback(fmt.Errorf("check migration %03d_%s: %w", migration.Version, migration.Name, err))
	}

	if _, err := tx.Exec(migration.SQL); err != nil {
		return rollback(fmt.Errorf("apply migration %03d_%s: %w", migration.Version, migration.Name, err))
	}
	if _, err := tx.Exec(`
		INSERT INTO schema_migrations (version, name)
		VALUES ($1, $2)
	`, migration.Version, migration.Name); err != nil {
		return rollback(fmt.Errorf("record migration %03d_%s: %w", migration.Version, migration.Name, err))
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit migration %03d_%s: %w", migration.Version, migration.Name, err)
	}
	return nil
}
