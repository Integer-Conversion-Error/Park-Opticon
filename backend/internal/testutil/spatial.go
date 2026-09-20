// Package testutil provides fixtures for opt-in PostGIS integration tests.
package testutil

import (
	"fmt"
	"os"
	"testing"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/config"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/database"
)

func OpenPostGIS(t *testing.T) *sqlx.DB {
	t.Helper()
	dsn := os.Getenv("PARKOPTICON_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("PARKOPTICON_TEST_DATABASE_URL is not configured")
	}
	db, err := sqlx.Connect("postgres", dsn)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	if err := database.RunMigrations(db, config.DatabaseConfig{}); err != nil {
		t.Fatal(err)
	}
	return db
}

func User(t *testing.T, db *sqlx.DB, radius int) uuid.UUID {
	t.Helper()
	id := uuid.New()
	_, err := db.Exec(`INSERT INTO users (id, email, username, notification_radius_meters)
 VALUES ($1, $2, $3, $4)`, id, id.String()+"@example.com", id.String(), radius)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if _, err := db.Exec(`DELETE FROM users WHERE id = $1`, id); err != nil {
			t.Error(err)
		}
	})
	return id
}

// Report projects a fixture from an origin by an independently specified metre
// distance. ST_Project uses geography (metres), not planar degree offsets:
// https://postgis.net/docs/ST_Project.html
func Report(t *testing.T, db *sqlx.DB, kind string, author uuid.UUID, lat, lon, meters float64) uuid.UUID {
	t.Helper()
	id := uuid.New()
	var query string
	switch kind {
	case "parking":
		query = `INSERT INTO parking_spots (id, reporter_id, location, latitude, longitude, expires_at)
   SELECT $1, $2, point, ST_Y(point::geometry), ST_X(point::geometry), CURRENT_TIMESTAMP + INTERVAL '1 hour'
   FROM (SELECT ST_Project(ST_SetSRID(ST_MakePoint($3, $4),4326)::geography, $5::double precision, pi()/2) AS point) p`
	case "enforcement":
		query = `INSERT INTO enforcement_alerts (id, reporter_id, location, latitude, longitude, enforcement_type, description, expires_at)
   SELECT $1, $2, point, ST_Y(point::geometry), ST_X(point::geometry), 'ticketing', 'Spatial test', CURRENT_TIMESTAMP + INTERVAL '1 hour'
   FROM (SELECT ST_Project(ST_SetSRID(ST_MakePoint($3, $4),4326)::geography, $5::double precision, pi()/2) AS point) p`
	default:
		t.Fatalf("unknown report kind %q", kind)
	}
	if _, err := db.Exec(query, id, author, lon, lat, meters); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if _, err := db.Exec(`DELETE FROM verifications WHERE verifiable_id = $1`, id); err != nil {
			t.Error(err)
		}
		table := "parking_spots"
		if kind == "enforcement" {
			table = "enforcement_alerts"
		}
		if _, err := db.Exec(fmt.Sprintf(`DELETE FROM %s WHERE id = $1`, table), id); err != nil {
			t.Error(err)
		}
	})
	return id
}

func Session(t *testing.T, db *sqlx.DB, user uuid.UUID, lat, lon float64) uuid.UUID {
	t.Helper()
	id := uuid.New()
	_, err := db.Exec(`INSERT INTO parking_sessions (id, user_id, location, latitude, longitude, started_at)
 VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4),4326)::geography, $4, $3, CURRENT_TIMESTAMP - INTERVAL '1 minute')`, id, user, lon, lat)
	if err != nil {
		t.Fatal(err)
	}
	return id // Cascades when the fixture user is removed.
}
