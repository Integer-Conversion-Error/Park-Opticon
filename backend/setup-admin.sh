#!/bin/bash

# Database setup script for Park-Opticon

echo "Creating database and admin user..."

# Create database
sudo -u postgres psql <<EOF
-- Create database if it doesn't exist
SELECT 'CREATE DATABASE parkopticon'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'parkopticon')\gexec

-- Connect to parkopticon database
\c parkopticon

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create admin user (password: admin123)
INSERT INTO users (
    id, email, username, password_hash, full_name,
    karma_points, notifications_enabled, enforcement_alerts_enabled,
    parking_radius_miles, email_verified, is_active, is_admin
)
VALUES (
    gen_random_uuid(),
    'admin@parkopticon.com',
    'admin',
    '\$2a\$10\$rLZvzl4xH7e6R8PjZKfVY.xQH9KN6KqZZ5nH5V8YhWvJ6Z7nQ8zQG', -- bcrypt hash of "admin123"
    'Admin User',
    0,
    true,
    true,
    5.0,
    true,
    true,
    true
)
ON CONFLICT (email) DO UPDATE SET is_admin = true;

-- Show admin user
SELECT email, username, is_admin FROM users WHERE email = 'admin@parkopticon.com';

EOF

echo ""
echo "✅ Database setup complete!"
echo ""
echo "Admin credentials:"
echo "  Email: admin@parkopticon.com"
echo "  Password: admin123"
echo ""
