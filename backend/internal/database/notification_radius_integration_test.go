package database

import (
	"os"
	"testing"

	"github.com/jmoiron/sqlx"
)

func TestLimitNotificationRadiusMigrationIntegration(t *testing.T) {
	dsn := os.Getenv("PARKOPTICON_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("PARKOPTICON_TEST_DATABASE_URL is not configured")
	}
	bootstrapSQL, err := os.ReadFile("../../migrations/016_limit_notification_radius.sql")
	if err != nil {
		t.Fatal(err)
	}
	for _, path := range []string{"runtime", "bootstrap"} {
		t.Run(path, func(t *testing.T) {
			db, err := sqlx.Connect("postgres", dsn)
			if err != nil {
				t.Fatal(err)
			}
			defer db.Close()
			// Temporary tables isolate the old schema fixture from the real migrated
			// database. One connection keeps all migration statements in this session.
			db.SetMaxOpenConns(1)
			_, err = db.Exec(`
    CREATE TEMP TABLE users (
     id integer PRIMARY KEY,
     notification_radius_meters integer NOT NULL DEFAULT 1000,
     updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT users_notification_radius_check CHECK (notification_radius_meters BETWEEN 100 AND 2500)
    );
    CREATE TEMP TABLE schema_migrations (version integer PRIMARY KEY, name text NOT NULL UNIQUE);
    INSERT INTO users (id, notification_radius_meters) VALUES (1, 100), (2, 1000), (3, 1500), (4, 1750), (5, 2500);
   `)
			if err != nil {
				t.Fatal(err)
			}
			for attempt := 0; attempt < 2; attempt++ {
				if path == "runtime" {
					err = applyMigration(db, schemaMigration{Version: 28, Name: "limit_notification_radius", SQL: limitNotificationRadius})
				} else {
					_, err = db.Exec(string(bootstrapSQL))
				}
				if err != nil {
					t.Fatal(err)
				}
			}
			var radii []int
			if err := db.Select(&radii, `SELECT notification_radius_meters FROM users ORDER BY id`); err != nil {
				t.Fatal(err)
			}
			for index, want := range []int{100, 1000, 1500, 1500, 1500} {
				if radii[index] != want {
					t.Fatalf("user %d radius = %d, want %d", index+1, radii[index], want)
				}
			}
			for _, radius := range []int{99, 1501, 2500} {
				if _, err := db.Exec(`UPDATE users SET notification_radius_meters = $1 WHERE id = 1`, radius); err == nil {
					t.Fatalf("constraint allowed %d", radius)
				}
			}
			if _, err := db.Exec(`INSERT INTO users (id) VALUES (6)`); err != nil {
				t.Fatal(err)
			}
			var defaultRadius int
			if err := db.Get(&defaultRadius, `SELECT notification_radius_meters FROM users WHERE id = 6`); err != nil {
				t.Fatal(err)
			}
			if defaultRadius != 1000 {
				t.Fatalf("default = %d, want 1000", defaultRadius)
			}
		})
	}
}
