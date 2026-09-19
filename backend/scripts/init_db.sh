#!/bin/bash

# Park Opticon Database Initialization Script
# This script creates the database and runs all migrations

set -e  # Exit on error

echo "🚀 Park Opticon Database Initialization"
echo "========================================"
echo ""

# Database connection parameters
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-parkopticon}"
DB_NAME="${DB_NAME:-parkopticon_db}"
DB_PASSWORD="${DB_PASSWORD:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to run SQL command
run_sql() {
    if [ -z "$DB_PASSWORD" ]; then
        psql -v ON_ERROR_STOP=1 -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "$1" 2>&1
    else
        PGPASSWORD="$DB_PASSWORD" psql -v ON_ERROR_STOP=1 -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "$1" 2>&1
    fi
}

# Function to run SQL file
run_sql_file() {
    if [ -z "$DB_PASSWORD" ]; then
        psql -v ON_ERROR_STOP=1 -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$1" 2>&1
    else
        PGPASSWORD="$DB_PASSWORD" psql -v ON_ERROR_STOP=1 -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$1" 2>&1
    fi
}

echo "📋 Configuration:"
echo "  Host: $DB_HOST"
echo "  Port: $DB_PORT"
echo "  User: $DB_USER"
echo "  Database: $DB_NAME"
echo ""

# Check if PostgreSQL is running
echo "🔍 Checking PostgreSQL connection..."
if ! run_sql "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${RED}❌ Cannot connect to PostgreSQL!${NC}"
    echo "   Make sure PostgreSQL is running and credentials are correct."
    echo "   You can set DB_USER and DB_PASSWORD environment variables."
    exit 1
fi
echo -e "${GREEN}✅ PostgreSQL connection successful${NC}"
echo ""

# Check if database exists
echo "🔍 Checking if database exists..."
DB_EXISTS=$(run_sql "SELECT 1 FROM pg_database WHERE datname='$DB_NAME';" | grep -c "1" || true)

if [ "$DB_EXISTS" -eq "1" ]; then
    echo -e "${YELLOW}⚠️  Database '$DB_NAME' already exists${NC}"
    read -p "   Do you want to DROP and recreate it? (yes/no): " -r
    echo ""
    if [[ $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        echo "🗑️  Dropping existing database..."
        run_sql "DROP DATABASE $DB_NAME;" > /dev/null
        echo -e "${GREEN}✅ Database dropped${NC}"
    else
        echo "❌ Aborted. Existing database preserved."
        exit 0
    fi
fi

# Create database
echo "🏗️  Creating database '$DB_NAME'..."
run_sql "CREATE DATABASE $DB_NAME;" > /dev/null
echo -e "${GREEN}✅ Database created${NC}"
echo ""

# Run migrations
MIGRATION_DIR="$(dirname "$0")/../migrations"
echo "📦 Running migrations from: $MIGRATION_DIR"
echo ""

if [ ! -d "$MIGRATION_DIR" ]; then
    echo -e "${RED}❌ Migrations directory not found: $MIGRATION_DIR${NC}"
    exit 1
fi

# Run each migration file in order
for migration in "$MIGRATION_DIR"/*.sql; do
    if [ -f "$migration" ]; then
        echo "   📄 Applying $(basename "$migration")..."
        if run_sql_file "$migration" > /dev/null 2>&1; then
            echo -e "   ${GREEN}✅ $(basename "$migration") applied${NC}"
        else
            echo -e "   ${RED}❌ Failed to apply $(basename "$migration")${NC}"
            exit 1
        fi
    fi
done

echo ""
echo "🎉 Database initialization complete!"
echo ""
echo "📊 Database Summary:"

# Count tables
TABLE_COUNT=$(run_sql_file <(echo "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';") | grep -oP '\d+' | head -1)
echo "   Tables created: $TABLE_COUNT"

# Count admin users
ADMIN_COUNT=$(run_sql_file <(echo "SELECT COUNT(*) FROM users WHERE is_admin = true;") | grep -oP '\d+' | head -1)
echo "   Admin users: $ADMIN_COUNT"

echo ""
echo "🔐 No default admin account is created. Run setup-admin.sh with ADMIN_EMAIL and ADMIN_PASSWORD, then enroll MFA."
echo ""
echo "✅ You can now start the backend server:"
echo "   cd backend && ./start.sh"
echo ""
