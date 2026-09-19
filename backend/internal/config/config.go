package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Server   ServerConfig
	Database DatabaseConfig
	JWT      JWTConfig
	AWS      AWSConfig
	Firebase FirebaseConfig
	OAuth    OAuthConfig
	Push     PushConfig
	Worker   WorkerConfig
	CORS     CORSConfig
	Security SecurityConfig
}

type ServerConfig struct {
	Port         string
	Env          string
	APIVersion   string
	ReadTimeout  time.Duration
	WriteTimeout time.Duration
	IdleTimeout  time.Duration
	MaxBodyBytes int64
}

type DatabaseConfig struct {
	Host               string
	Port               string
	User               string
	Password           string
	Name               string
	SSLMode            string
	SSLRootCert        string
	ConnectTimeout     time.Duration
	StatementTimeout   time.Duration
	MaxOpenConns       int
	MaxIdleConns       int
	ConnMaxLifetime    time.Duration
	ConnMaxIdleTime    time.Duration
	AllowInsecureLocal bool
}

type JWTConfig struct {
	Secret           string
	AccessExpiry     time.Duration
	RefreshExpiry    time.Duration
	MFAEncryptionKey string
	AdminMFAStepUp   time.Duration
}

type AWSConfig struct {
	Region          string
	AccessKeyID     string
	SecretAccessKey string
	S3BucketName    string
	PhotoMaxSizeMB  int
}

type FirebaseConfig struct {
	ProjectID       string
	CredentialsPath string
}

// OAuthConfig contains public provider client identifiers plus the server-only
// Google Web-client secret used to exchange native one-time auth codes. That
// secret must never be sent to, or bundled with, the mobile app.
type OAuthConfig struct {
	GoogleClientIDs      []string
	GoogleServerClientID string
	GoogleClientSecret   string
	AppleClientIDs       []string
	ChallengeExpiry      time.Duration
	LinkReauthExpiry     time.Duration
	JWKSCacheTTL         time.Duration
}

type PushConfig struct {
	ExpoAccessToken string
}

type WorkerConfig struct {
	AlertDispatchInterval time.Duration
	ExpiryCheckInterval   time.Duration
	JobLeaseDuration      time.Duration
	DispatchBatchSize     int
	DeliveryBatchSize     int
	AlertRadiusMeters     float64
}

type CORSConfig struct {
	AllowedOrigins   []string
	AllowCredentials bool
}

type SecurityConfig struct {
	DefaultRequestsPerMinute int
	AuthRequestsPerMinute    int
	ReportRequestsPerHour    int
	AdminRequestsPerMinute   int
	TrustedProxies           []string
}

func Load() *Config {
	return &Config{
		Server: ServerConfig{
			Port:         getEnv("PORT", "8080"),
			Env:          getEnv("ENV", "development"),
			APIVersion:   getEnv("API_VERSION", "v1"),
			ReadTimeout:  parseDuration(getEnv("HTTP_READ_TIMEOUT", "15s")),
			WriteTimeout: parseDuration(getEnv("HTTP_WRITE_TIMEOUT", "15s")),
			IdleTimeout:  parseDuration(getEnv("HTTP_IDLE_TIMEOUT", "60s")),
			MaxBodyBytes: int64(parseInt(getEnv("HTTP_MAX_BODY_BYTES", "1048576"), 1048576)),
		},
		Database: DatabaseConfig{
			Host:               getEnv("DB_HOST", "localhost"),
			Port:               getEnv("DB_PORT", "5432"),
			User:               getEnv("DB_USER", "parkopticon"),
			Password:           getEnv("DB_PASSWORD", ""),
			Name:               getEnv("DB_NAME", "parkopticon_db"),
			SSLMode:            getEnv("DB_SSLMODE", "disable"),
			SSLRootCert:        getEnv("DB_SSLROOTCERT", ""),
			ConnectTimeout:     parseDuration(getEnv("DB_CONNECT_TIMEOUT", "5s")),
			StatementTimeout:   parseDuration(getEnv("DB_STATEMENT_TIMEOUT", "5s")),
			MaxOpenConns:       parseInt(getEnv("DB_MAX_OPEN_CONNS", "20"), 20),
			MaxIdleConns:       parseInt(getEnv("DB_MAX_IDLE_CONNS", "5"), 5),
			ConnMaxLifetime:    parseDuration(getEnv("DB_CONN_MAX_LIFETIME", "30m")),
			ConnMaxIdleTime:    parseDuration(getEnv("DB_CONN_MAX_IDLE_TIME", "5m")),
			AllowInsecureLocal: parseBool(getEnv("DB_ALLOW_INSECURE_LOCAL", "false"), false),
		},
		JWT: JWTConfig{
			Secret:           getEnv("JWT_SECRET", "change_this_secret_in_production"),
			AccessExpiry:     parseDuration(getEnv("JWT_ACCESS_EXPIRY", "15m")),
			RefreshExpiry:    parseDuration(getEnv("JWT_REFRESH_EXPIRY", "720h")),
			MFAEncryptionKey: getEnv("MFA_ENCRYPTION_KEY", ""),
			AdminMFAStepUp:   parseDuration(getEnv("ADMIN_MFA_STEP_UP", "10m")),
		},
		AWS: AWSConfig{
			Region:          getEnv("AWS_REGION", "us-east-1"),
			AccessKeyID:     getEnv("AWS_ACCESS_KEY_ID", ""),
			SecretAccessKey: getEnv("AWS_SECRET_ACCESS_KEY", ""),
			S3BucketName:    getEnv("S3_BUCKET_NAME", "parkopticon-photos"),
			PhotoMaxSizeMB:  5,
		},
		Firebase: FirebaseConfig{
			ProjectID:       getEnv("FIREBASE_PROJECT_ID", ""),
			CredentialsPath: getEnv("FIREBASE_CREDENTIALS_PATH", "./firebase-credentials.json"),
		},
		OAuth: OAuthConfig{
			GoogleClientIDs:      parseList(getEnv("GOOGLE_OAUTH_CLIENT_IDS", "")),
			GoogleServerClientID: getEnv("GOOGLE_OAUTH_SERVER_CLIENT_ID", ""),
			GoogleClientSecret:   getEnv("GOOGLE_OAUTH_CLIENT_SECRET", ""),
			AppleClientIDs:       parseList(getEnv("APPLE_OAUTH_CLIENT_IDS", "")),
			ChallengeExpiry:      parseDuration(getEnv("OAUTH_CHALLENGE_EXPIRY", "5m")),
			LinkReauthExpiry:     parseDuration(getEnv("OAUTH_LINK_REAUTH_EXPIRY", "5m")),
			JWKSCacheTTL:         parseDuration(getEnv("OAUTH_JWKS_CACHE_TTL", "6h")),
		},
		Push: PushConfig{
			ExpoAccessToken: getEnv("EXPO_PUSH_ACCESS_TOKEN", ""),
		},
		Worker: WorkerConfig{
			// ALERT_CHECK_INTERVAL is retained as a compatibility fallback for
			// existing deployments. The worker now polls a durable job queue rather
			// than scanning every active parking session.
			AlertDispatchInterval: parseDuration(getEnv("ALERT_DISPATCH_INTERVAL", getEnv("ALERT_CHECK_INTERVAL", "1s"))),
			ExpiryCheckInterval:   parseDuration(getEnv("SPOT_EXPIRY_CHECK_INTERVAL", "5m")),
			JobLeaseDuration:      parseDuration(getEnv("WORKER_JOB_LEASE", "2m")),
			DispatchBatchSize:     parseInt(getEnv("ALERT_DISPATCH_BATCH_SIZE", "25"), 25),
			DeliveryBatchSize:     parseInt(getEnv("PUSH_DELIVERY_BATCH_SIZE", "100"), 100),
			AlertRadiusMeters:     parseFloat(getEnv("ENFORCEMENT_ALERT_RADIUS_METERS", "1000"), 1000),
		},
		CORS: CORSConfig{
			AllowedOrigins:   parseOrigins(getEnv("CORS_ALLOWED_ORIGINS", "*")),
			AllowCredentials: parseBool(getEnv("CORS_ALLOW_CREDENTIALS", "true"), true),
		},
		Security: SecurityConfig{
			DefaultRequestsPerMinute: parseInt(getEnv("RATE_LIMIT_REQUESTS_PER_MINUTE", "120"), 120),
			AuthRequestsPerMinute:    parseInt(getEnv("RATE_LIMIT_AUTH_PER_MINUTE", "10"), 10),
			ReportRequestsPerHour:    parseInt(getEnv("RATE_LIMIT_REPORTS_PER_HOUR", "20"), 20),
			AdminRequestsPerMinute:   parseInt(getEnv("RATE_LIMIT_ADMIN_PER_MINUTE", "120"), 120),
			TrustedProxies:           parseList(getEnv("TRUSTED_PROXIES", "")),
		},
	}
}

func (c *Config) Validate() error {
	return c.validate(true)
}

// ValidateWorker checks the shared runtime configuration without requiring
// API-only OAuth client secrets. The alert worker never handles sign-in.
func (c *Config) ValidateWorker() error {
	return c.validate(false)
}

func (c *Config) validate(requireOAuth bool) error {
	for _, key := range []string{"OAUTH_CHALLENGE_EXPIRY", "OAUTH_LINK_REAUTH_EXPIRY", "OAUTH_JWKS_CACHE_TTL"} {
		if err := validateConfiguredDuration(key); err != nil {
			return err
		}
	}
	if c.Server.MaxBodyBytes < 1024 || c.Server.MaxBodyBytes > 16*1024*1024 {
		return fmt.Errorf("HTTP_MAX_BODY_BYTES must be between 1024 and 16777216")
	}
	if c.JWT.AccessExpiry <= 0 || c.JWT.AccessExpiry > time.Hour {
		return fmt.Errorf("JWT_ACCESS_EXPIRY must be greater than zero and no more than one hour")
	}
	if c.JWT.RefreshExpiry <= c.JWT.AccessExpiry {
		return fmt.Errorf("JWT_REFRESH_EXPIRY must be longer than JWT_ACCESS_EXPIRY")
	}
	if c.Worker.AlertDispatchInterval <= 0 || c.Worker.ExpiryCheckInterval <= 0 || c.Worker.JobLeaseDuration <= 0 {
		return fmt.Errorf("worker intervals and leases must be greater than zero")
	}
	if c.Worker.DispatchBatchSize < 1 || c.Worker.DeliveryBatchSize < 1 || c.Worker.DeliveryBatchSize > 100 {
		return fmt.Errorf("worker batch sizes must be positive and PUSH_DELIVERY_BATCH_SIZE must not exceed 100")
	}
	if c.OAuth.ChallengeExpiry <= 0 || c.OAuth.ChallengeExpiry > 15*time.Minute {
		return fmt.Errorf("OAUTH_CHALLENGE_EXPIRY must be greater than zero and no more than 15 minutes")
	}
	if c.OAuth.LinkReauthExpiry <= 0 || c.OAuth.LinkReauthExpiry > 15*time.Minute {
		return fmt.Errorf("OAUTH_LINK_REAUTH_EXPIRY must be greater than zero and no more than 15 minutes")
	}
	if c.OAuth.JWKSCacheTTL <= 0 || c.OAuth.JWKSCacheTTL > 24*time.Hour {
		return fmt.Errorf("OAUTH_JWKS_CACHE_TTL must be greater than zero and no more than 24 hours")
	}
	if c.Server.Env == "production" {
		if len(c.JWT.Secret) < 32 || c.JWT.Secret == "change_this_secret_in_production" {
			return fmt.Errorf("JWT_SECRET must be a unique 32-character production secret")
		}
		if c.JWT.MFAEncryptionKey == "" {
			return fmt.Errorf("MFA_ENCRYPTION_KEY is required in production")
		}
		if c.Push.ExpoAccessToken == "" {
			return fmt.Errorf("EXPO_PUSH_ACCESS_TOKEN is required in production")
		}
		if c.Database.SSLMode == "" {
			return fmt.Errorf("DB_SSLMODE is required in production")
		}
		if c.Database.SSLMode == "disable" {
			if !c.Database.AllowInsecureLocal || !isPrivateDatabaseHost(c.Database.Host) {
				return fmt.Errorf("DB_SSLMODE=disable is allowed only for an explicitly opted-in private local database")
			}
		}
		if requireOAuth {
			if len(c.OAuth.GoogleClientIDs) == 0 || c.OAuth.GoogleServerClientID == "" || c.OAuth.GoogleClientSecret == "" || len(c.OAuth.AppleClientIDs) == 0 {
				return fmt.Errorf("GOOGLE_OAUTH_CLIENT_IDS, GOOGLE_OAUTH_SERVER_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, and APPLE_OAUTH_CLIENT_IDS are required in production")
			}
			if !containsString(c.OAuth.GoogleClientIDs, c.OAuth.GoogleServerClientID) {
				return fmt.Errorf("GOOGLE_OAUTH_SERVER_CLIENT_ID must be included in GOOGLE_OAUTH_CLIENT_IDS")
			}
		}
		for _, origin := range c.CORS.AllowedOrigins {
			if origin == "*" {
				return fmt.Errorf("CORS_ALLOWED_ORIGINS cannot contain * in production")
			}
		}
	}
	return nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func parseDuration(s string) time.Duration {
	d, err := time.ParseDuration(s)
	if err != nil {
		return 15 * time.Minute
	}
	return d
}

func validateConfiguredDuration(key string) error {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return nil
	}
	if _, err := time.ParseDuration(value); err != nil {
		return fmt.Errorf("%s must be a valid duration: %w", key, err)
	}
	return nil
}

func parseFloat(s string, fallback float64) float64 {
	value, err := strconv.ParseFloat(s, 64)
	if err != nil || value <= 0 {
		return fallback
	}
	return value
}

func parseInt(s string, fallback int) int {
	value, err := strconv.Atoi(s)
	if err != nil || value <= 0 {
		return fallback
	}
	return value
}

func parseBool(s string, fallback bool) bool {
	value, err := strconv.ParseBool(s)
	if err != nil {
		return fallback
	}
	return value
}

func parseOrigins(value string) []string {
	origins := parseList(value)
	if len(origins) == 0 {
		return []string{"*"}
	}
	return origins
}

func parseList(value string) []string {
	parts := strings.Split(value, ",")
	items := make([]string, 0, len(parts))
	for _, part := range parts {
		if item := strings.TrimSpace(part); item != "" {
			items = append(items, item)
		}
	}
	return items
}

func containsString(values []string, expected string) bool {
	for _, value := range values {
		if value == expected {
			return true
		}
	}
	return false
}

func isPrivateDatabaseHost(host string) bool {
	switch strings.ToLower(strings.TrimSpace(host)) {
	case "postgres", "localhost", "127.0.0.1", "::1":
		return true
	default:
		return false
	}
}
