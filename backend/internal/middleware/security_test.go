package middleware

import (
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/config"
)

func TestRequestRateLimiter(t *testing.T) {
	limiter := newRequestRateLimiter(10)
	if allowed, _ := limiter.allow("ip:auth", 2, time.Minute); !allowed {
		t.Fatal("first request should be allowed")
	}
	if allowed, _ := limiter.allow("ip:auth", 2, time.Minute); !allowed {
		t.Fatal("second request should be allowed")
	}
	if allowed, retry := limiter.allow("ip:auth", 2, time.Minute); allowed || retry <= 0 {
		t.Fatal("third request should be rate limited")
	}
}

func TestRateLimitClassifiesAuthAndAdmin(t *testing.T) {
	cfg := config.Load()
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest("POST", "/api/v1/auth/login", nil)
	limit, window := rateLimitForRequest(ctx, cfg)
	if limit != cfg.Security.AuthRequestsPerMinute || window != time.Minute {
		t.Fatalf("unexpected auth limit: %d %v", limit, window)
	}
	ctx.Request = httptest.NewRequest("GET", "/api/v1/admin/users", nil)
	limit, window = rateLimitForRequest(ctx, cfg)
	if limit != cfg.Security.AdminRequestsPerMinute || window != time.Minute {
		t.Fatalf("unexpected admin limit: %d %v", limit, window)
	}
}
