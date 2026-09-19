package handlers

import (
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestParseFeedLocation(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recording := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recording)
	ctx.Request = httptest.NewRequest("GET", "/feed?latitude=45.4215&longitude=-75.6972&radius_meters=2500", nil)

	latitude, longitude, radius, err := parseFeedLocation(ctx)
	if err != nil {
		t.Fatalf("parse location: %v", err)
	}
	if latitude != 45.4215 || longitude != -75.6972 || radius != 2500 {
		t.Fatalf("unexpected location: %v, %v, %v", latitude, longitude, radius)
	}
}

func TestParseFeedLocationRejectsLargeRadius(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest("GET", "/feed?latitude=45.4215&longitude=-75.6972&radius_meters=2501", nil)

	if _, _, _, err := parseFeedLocation(ctx); err == nil {
		t.Fatal("expected radius validation error")
	}
}

func TestParseFeedLocationUsesOneKilometreDefault(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest("GET", "/feed?latitude=45.4215&longitude=-75.6972", nil)

	_, _, radius, err := parseFeedLocation(ctx)
	if err != nil {
		t.Fatalf("parse default radius: %v", err)
	}
	if radius != 1000 {
		t.Fatalf("unexpected default radius: got %d want 1000", radius)
	}
}

func TestValidateCoordinates(t *testing.T) {
	if err := validateCoordinates(45.4215, -75.6972); err != nil {
		t.Fatalf("valid coordinates rejected: %v", err)
	}
	if err := validateCoordinates(91, 0); err == nil {
		t.Fatal("expected invalid latitude to be rejected")
	}
}
