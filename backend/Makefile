# Park-Opticon Backend - Makefile for Windows PowerShell
# Run commands with: make <target>

.PHONY: help install run build test clean docker-up docker-down migrate

# Default target
help:
	@echo "Park-Opticon Backend - Available Commands:"
	@echo ""
	@echo "  make install      - Download Go dependencies"
	@echo "  make run          - Run the development server"
	@echo "  make build        - Build production binary"
	@echo "  make test         - Run tests"
	@echo "  make clean        - Clean build artifacts"
	@echo "  make docker-up    - Start PostgreSQL with Docker"
	@echo "  make docker-down  - Stop PostgreSQL Docker container"
	@echo ""

# Install dependencies
install:
	go mod download
	go mod tidy

# Run development server
run:
	go run cmd/server/main.go

# Build production binary
build:
	@if not exist "bin" mkdir bin
	go build -o bin/server.exe cmd/server/main.go
	@echo "Binary built: bin/server.exe"

# Build for Linux (deployment)
build-linux:
	@if not exist "bin" mkdir bin
	$env:GOOS="linux"; $env:GOARCH="amd64"; go build -o bin/server cmd/server/main.go
	@echo "Linux binary built: bin/server"

# Run tests
test:
	go test -v ./...

# Run tests with coverage
test-coverage:
	go test -cover ./...
	go test -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out -o coverage.html
	@echo "Coverage report: coverage.html"

# Clean build artifacts
clean:
	@if exist "bin" rmdir /s /q bin
	@if exist "coverage.out" del coverage.out
	@if exist "coverage.html" del coverage.html
	@echo "Cleaned build artifacts"

# Start PostgreSQL with Docker
docker-up:
	docker run --name parkopticon-db `
		-e POSTGRES_USER=parkopticon `
		-e POSTGRES_PASSWORD=parkopticon123 `
		-e POSTGRES_DB=parkopticon_db `
		-p 5432:5432 `
		-d postgis/postgis:latest
	@echo "PostgreSQL with PostGIS started on port 5432"

# Stop PostgreSQL Docker container
docker-down:
	docker stop parkopticon-db
	docker rm parkopticon-db
	@echo "PostgreSQL container stopped and removed"

# Format code
fmt:
	go fmt ./...
	@echo "Code formatted"

# Run linter
lint:
	golangci-lint run
	@echo "Linting complete"

# Install development tools
dev-tools:
	go install github.com/cosmtrek/air@latest
	go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
	@echo "Development tools installed"

# Run with hot reload (requires air)
dev:
	air
