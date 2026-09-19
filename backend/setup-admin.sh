#!/bin/bash

# Database setup script for Park-Opticon

set -euo pipefail

: "${ADMIN_EMAIL:?Set ADMIN_EMAIL before running this script}"
: "${ADMIN_PASSWORD:?Set ADMIN_PASSWORD before running this script}"
DB_NAME="${DB_NAME:-parkopticon_db}"
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
ADMIN_HASH="$(go run ./cmd/hashpw "$ADMIN_PASSWORD")"

echo "Creating database and admin user..."

# Create database
sudo -u postgres psql <<EOF
-- Create database if it doesn't exist
SELECT 'CREATE DATABASE $DB_NAME'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DB_NAME')\gexec

-- Connect to parkopticon database
\c $DB_NAME

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

INSERT INTO users (
    id, email, username, password_hash, full_name,
    karma_points, notifications_enabled, enforcement_alerts_enabled,
    parking_radius_miles, email_verified, is_active, is_admin, mfa_enabled
)
VALUES (
    gen_random_uuid(),
    '$ADMIN_EMAIL',
    '$ADMIN_USERNAME',
    '$ADMIN_HASH',
    'Admin User',
    0,
    true,
    true,
    5.0,
    true,
    true,
    true,
    true,
    false
)
ON CONFLICT (email) DO UPDATE SET is_admin = true;

-- Show admin user
SELECT email, username, is_admin FROM users WHERE email = '$ADMIN_EMAIL';

EOF

echo ""
echo "✅ Database setup complete!"
echo "Admin account created. MFA enrollment is required at first admin login."
