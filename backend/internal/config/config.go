package config

import (
	"os"
	"time"
)

type Config struct {
	Server   ServerConfig
	Database DatabaseConfig
	JWT      JWTConfig
	AWS      AWSConfig
	Firebase FirebaseConfig
	Worker   WorkerConfig
	CORS     CORSConfig
}

type ServerConfig struct {
	Port       string
	Env        string
	APIVersion string
}

type DatabaseConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	Name     string
	SSLMode  string
}

type JWTConfig struct {
	Secret        string
	AccessExpiry  time.Duration
	RefreshExpiry time.Duration
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

type WorkerConfig struct {
	AlertCheckInterval  time.Duration
	ExpiryCheckInterval time.Duration
}

type CORSConfig struct {
	AllowedOrigins   []string
	AllowCredentials bool
}

func Load() *Config {
	return &Config{
		Server: ServerConfig{
			Port:       getEnv("PORT", "8080"),
			Env:        getEnv("ENV", "development"),
			APIVersion: getEnv("API_VERSION", "v1"),
		},
		Database: DatabaseConfig{
			Host:     getEnv("DB_HOST", "localhost"),
			Port:     getEnv("DB_PORT", "5432"),
			User:     getEnv("DB_USER", "parkopticon"),
			Password: getEnv("DB_PASSWORD", ""),
			Name:     getEnv("DB_NAME", "parkopticon_db"),
			SSLMode:  getEnv("DB_SSLMODE", "disable"),
		},
		JWT: JWTConfig{
			Secret:        getEnv("JWT_SECRET", "change_this_secret_in_production"),
			AccessExpiry:  parseDuration(getEnv("JWT_ACCESS_EXPIRY", "15m")),
			RefreshExpiry: parseDuration(getEnv("JWT_REFRESH_EXPIRY", "168h")),
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
		Worker: WorkerConfig{
			AlertCheckInterval:  parseDuration(getEnv("ALERT_CHECK_INTERVAL", "30s")),
			ExpiryCheckInterval: parseDuration(getEnv("SPOT_EXPIRY_CHECK_INTERVAL", "5m")),
		},
		CORS: CORSConfig{
			AllowedOrigins: []string{
				"*", // Allow all origins for debugging
			},
			AllowCredentials: true,
		},
	}
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
