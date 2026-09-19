package auth

import (
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestAccessTokenRoundTrip(t *testing.T) {
	userID := uuid.New()
	token, err := GenerateAccessToken(userID, "driver@example.com", "driver", false, "test-secret", time.Minute)
	if err != nil {
		t.Fatalf("generate token: %v", err)
	}

	claims, err := ValidateToken(token, "test-secret")
	if err != nil {
		t.Fatalf("validate token: %v", err)
	}
	if claims.UserID != userID || claims.Email != "driver@example.com" || claims.Username != "driver" || claims.TokenType != "access" {
		t.Fatalf("unexpected claims: %#v", claims)
	}
	if claims.Issuer != Issuer || len(claims.Audience) != 1 || claims.Audience[0] != Audience || claims.ID == "" {
		t.Fatalf("missing token identity claims: %#v", claims.RegisteredClaims)
	}
}

func TestValidateTokenRejectsWrongSecret(t *testing.T) {
	token, err := GenerateRefreshToken(uuid.New(), "test-secret", time.Minute)
	if err != nil {
		t.Fatalf("generate token: %v", err)
	}
	if _, err := ValidateToken(token, "wrong-secret"); err == nil {
		t.Fatal("expected wrong secret to be rejected")
	}
}
