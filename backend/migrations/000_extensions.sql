-- Extensions required by the runtime migrations.
-- Keep extension installation in migrations so the Go process does not need
-- schema-admin behavior at connection time.
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
