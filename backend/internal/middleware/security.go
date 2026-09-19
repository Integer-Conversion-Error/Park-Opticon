package middleware

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/config"
)

const requestIDHeader = "X-Request-ID"

type rateWindow struct {
	startedAt time.Time
	count     int
}

type requestRateLimiter struct {
	mu       sync.Mutex
	entries  map[string]rateWindow
	maxItems int
}

func newRequestRateLimiter(maxItems int) *requestRateLimiter {
	return &requestRateLimiter{entries: make(map[string]rateWindow), maxItems: maxItems}
}

func (l *requestRateLimiter) allow(key string, limit int, window time.Duration) (bool, time.Duration) {
	now := time.Now()
	l.mu.Lock()
	defer l.mu.Unlock()

	if len(l.entries) >= l.maxItems {
		for existingKey, item := range l.entries {
			if now.Sub(item.startedAt) >= window {
				delete(l.entries, existingKey)
			}
		}
		if len(l.entries) >= l.maxItems {
			return false, window
		}
	}

	item, exists := l.entries[key]
	if !exists || now.Sub(item.startedAt) >= window {
		l.entries[key] = rateWindow{startedAt: now, count: 1}
		return true, 0
	}
	if item.count >= limit {
		return false, window - now.Sub(item.startedAt)
	}
	item.count++
	l.entries[key] = item
	return true, 0
}

func RequestSecurity(cfg *config.Config) gin.HandlerFunc {
	limiter := newRequestRateLimiter(10000)

	return func(c *gin.Context) {
		requestID := strings.TrimSpace(c.GetHeader(requestIDHeader))
		if len(requestID) == 0 || len(requestID) > 128 || strings.ContainsAny(requestID, "\r\n") {
			requestID = newRequestID()
		}
		c.Set("request_id", requestID)
		c.Header(requestIDHeader, requestID)

		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Header("Referrer-Policy", "no-referrer")
		c.Header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		c.Header("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'")
		c.Header("Cache-Control", "no-store")
		if cfg.Server.Env == "production" {
			c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		}

		if c.Request.Body != nil {
			c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, cfg.Server.MaxBodyBytes)
		}

		limit, window := rateLimitForRequest(c, cfg)
		key := c.ClientIP() + ":" + rateLimitBucket(c)
		if allowed, retryAfter := limiter.allow(key, limit, window); !allowed {
			seconds := int(retryAfter.Seconds())
			if seconds < 1 {
				seconds = 1
			}
			c.Header("Retry-After", fmt.Sprintf("%d", seconds))
			Error(c, http.StatusTooManyRequests, "rate_limited", "Too many requests")
			c.Abort()
			return
		}

		c.Next()
	}
}

func RequestLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		startedAt := time.Now()
		c.Next()
		log.Printf("http_request request_id=%s method=%s route=%s status=%d latency_ms=%d client=%s",
			c.GetString("request_id"), c.Request.Method, c.FullPath(), c.Writer.Status(),
			time.Since(startedAt).Milliseconds(), c.ClientIP())
	}
}

func rateLimitForRequest(c *gin.Context, cfg *config.Config) (int, time.Duration) {
	path := c.Request.URL.Path
	if strings.Contains(path, "/auth/") {
		return cfg.Security.AuthRequestsPerMinute, time.Minute
	}
	if strings.HasPrefix(path, "/api/v1/admin") {
		return cfg.Security.AdminRequestsPerMinute, time.Minute
	}
	if c.Request.Method == http.MethodPost && (strings.Contains(path, "/parking-spots") || strings.Contains(path, "/enforcement-alerts")) {
		return cfg.Security.ReportRequestsPerHour, time.Hour
	}
	return cfg.Security.DefaultRequestsPerMinute, time.Minute
}

func rateLimitBucket(c *gin.Context) string {
	path := c.Request.URL.Path
	switch {
	case strings.Contains(path, "/auth/"):
		return "auth"
	case strings.HasPrefix(path, "/api/v1/admin"):
		return "admin"
	case strings.Contains(path, "/parking-spots") || strings.Contains(path, "/enforcement-alerts"):
		return "reports"
	default:
		return "default"
	}
}

func newRequestID() string {
	var bytes [16]byte
	if _, err := rand.Read(bytes[:]); err == nil {
		return hex.EncodeToString(bytes[:])
	}
	return fmt.Sprintf("%d", time.Now().UnixNano())
}
