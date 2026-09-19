package config

import (
	"strings"
	"testing"
)

func TestParseOrigins(t *testing.T) {
	origins := parseOrigins(" http://localhost:3000, https://app.example.com ")
	if len(origins) != 2 || origins[0] != "http://localhost:3000" || origins[1] != "https://app.example.com" {
		t.Fatalf("unexpected origins: %#v", origins)
	}

	wildcard := parseOrigins(" , ")
	if len(wildcard) != 1 || wildcard[0] != "*" {
		t.Fatalf("expected wildcard fallback, got %#v", wildcard)
	}
}

func TestLoadDatabasePoolDefaults(t *testing.T) {
	t.Setenv("DB_MAX_OPEN_CONNS", "")
	t.Setenv("DB_MAX_IDLE_CONNS", "")
	cfg := Load()
	if cfg.Database.MaxOpenConns != 20 || cfg.Database.MaxIdleConns != 5 {
		t.Fatalf("unexpected pool defaults: open=%d idle=%d", cfg.Database.MaxOpenConns, cfg.Database.MaxIdleConns)
	}
}

func TestLoadAlertRadiusDefault(t *testing.T) {
	t.Setenv("ENFORCEMENT_ALERT_RADIUS_METERS", "")
	cfg := Load()
	if cfg.Worker.AlertRadiusMeters != 1000 {
		t.Fatalf("unexpected default alert radius: %v", cfg.Worker.AlertRadiusMeters)
	}
}

func TestProductionConfigRejectsUnsafeDefaults(t *testing.T) {
	cfg := Load()
	cfg.Server.Env = "production"
	cfg.JWT.Secret = "short"
	cfg.JWT.MFAEncryptionKey = ""
	cfg.CORS.AllowedOrigins = []string{"*"}
	if err := cfg.Validate(); err == nil {
		t.Fatal("expected unsafe production configuration to be rejected")
	}
}

func TestProductionConfigRequiresExpoPushCredentials(t *testing.T) {
	cfg := Load()
	cfg.Server.Env = "production"
	cfg.JWT.Secret = strings.Repeat("j", 32)
	cfg.JWT.MFAEncryptionKey = strings.Repeat("m", 32)
	cfg.Database.SSLMode = "verify-full"
	cfg.CORS.AllowedOrigins = []string{"https://admin.example.com"}
	cfg.Push.ExpoAccessToken = ""

	if err := cfg.Validate(); err == nil || !strings.Contains(err.Error(), "EXPO_PUSH_ACCESS_TOKEN") {
		t.Fatalf("expected production push credentials error, got %v", err)
	}
}

func TestProductionConfigRequiresSocialSignInCredentials(t *testing.T) {
	cfg := Load()
	cfg.Server.Env = "production"
	cfg.JWT.Secret = strings.Repeat("j", 32)
	cfg.JWT.MFAEncryptionKey = strings.Repeat("m", 32)
	cfg.Database.SSLMode = "verify-full"
	cfg.CORS.AllowedOrigins = []string{"https://app.example.com"}
	cfg.Push.ExpoAccessToken = "push-token"
	cfg.OAuth.GoogleClientIDs = nil
	cfg.OAuth.GoogleServerClientID = ""
	cfg.OAuth.GoogleClientSecret = ""
	cfg.OAuth.AppleClientIDs = nil

	if err := cfg.Validate(); err == nil || !strings.Contains(err.Error(), "GOOGLE_OAUTH_CLIENT_IDS") {
		t.Fatalf("expected production social sign-in credentials error, got %v", err)
	}
}

func TestProductionWorkerConfigDoesNotRequireAPIOAuthSecret(t *testing.T) {
	cfg := Load()
	cfg.Server.Env = "production"
	cfg.JWT.Secret = strings.Repeat("j", 32)
	cfg.JWT.MFAEncryptionKey = strings.Repeat("m", 32)
	cfg.Database.SSLMode = "verify-full"
	cfg.CORS.AllowedOrigins = []string{"https://app.example.com"}
	cfg.Push.ExpoAccessToken = "push-token"
	cfg.OAuth.GoogleClientIDs = nil
	cfg.OAuth.GoogleServerClientID = ""
	cfg.OAuth.GoogleClientSecret = ""
	cfg.OAuth.AppleClientIDs = nil

	if err := cfg.ValidateWorker(); err != nil {
		t.Fatalf("worker config should not require API OAuth credentials: %v", err)
	}
}

func TestOAuthDurationRejectsInvalidEnvironmentValue(t *testing.T) {
	t.Setenv("OAUTH_LINK_REAUTH_EXPIRY", "not-a-duration")
	if err := Load().Validate(); err == nil || !strings.Contains(err.Error(), "OAUTH_LINK_REAUTH_EXPIRY") {
		t.Fatalf("expected OAuth duration validation error, got %v", err)
	}
}

func TestProductionConfigAllowsPrivateComposeDatabaseWithoutTLSWhenExplicit(t *testing.T) {
	cfg := Load()
	cfg.Server.Env = "production"
	cfg.JWT.Secret = strings.Repeat("j", 32)
	cfg.JWT.MFAEncryptionKey = strings.Repeat("m", 32)
	cfg.Push.ExpoAccessToken = "push-token"
	cfg.CORS.AllowedOrigins = []string{"https://app.example.com"}
	cfg.Database.Host = "postgres"
	cfg.Database.SSLMode = "disable"
	cfg.Database.AllowInsecureLocal = true
	cfg.OAuth.GoogleClientIDs = []string{"server-client"}
	cfg.OAuth.GoogleServerClientID = "server-client"
	cfg.OAuth.GoogleClientSecret = "server-secret"
	cfg.OAuth.AppleClientIDs = []string{"com.parkopticon.app"}

	if err := cfg.Validate(); err != nil {
		t.Fatalf("private Compose database config should be allowed: %v", err)
	}
}

func TestProductionConfigRejectsRemoteDatabaseWithoutTLS(t *testing.T) {
	cfg := Load()
	cfg.Server.Env = "production"
	cfg.JWT.Secret = strings.Repeat("j", 32)
	cfg.JWT.MFAEncryptionKey = strings.Repeat("m", 32)
	cfg.Push.ExpoAccessToken = "push-token"
	cfg.CORS.AllowedOrigins = []string{"https://app.example.com"}
	cfg.Database.Host = "db.example.com"
	cfg.Database.SSLMode = "disable"
	cfg.Database.AllowInsecureLocal = true

	if err := cfg.Validate(); err == nil || !strings.Contains(err.Error(), "private local database") {
		t.Fatalf("expected remote database TLS rejection, got %v", err)
	}
}
