package auth

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

func HashToken(token string) string {
	digest := sha256.Sum256([]byte(token))
	return hex.EncodeToString(digest[:])
}

var (
	ErrInvalidToken = errors.New("invalid token")
	ErrExpiredToken = errors.New("token has expired")
)

const passwordCost = 12

type Claims struct {
	UserID             uuid.UUID        `json:"user_id"`
	Email              string           `json:"email"`
	Username           string           `json:"username"`
	IsAdmin            bool             `json:"is_admin"`
	TokenType          string           `json:"token_type"`
	AdminMFAVerifiedAt *jwt.NumericDate `json:"admin_mfa_verified_at,omitempty"`
	jwt.RegisteredClaims
}

const (
	Issuer   = "parkopticon"
	Audience = "parkopticon-api"
)

// HashPassword hashes a plain text password
func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), passwordCost)
	return string(bytes), err
}

func NeedsPasswordRehash(hash string) bool {
	cost, err := bcrypt.Cost([]byte(hash))
	return err != nil || cost < passwordCost
}

// CheckPassword compares a plain text password with a hashed password
func CheckPassword(password, hash string) error {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
}

// GenerateAccessToken creates a new JWT access token
func GenerateAccessToken(userID uuid.UUID, email, username string, isAdmin bool, secret string, expiry time.Duration) (string, error) {
	return generateAccessToken(userID, email, username, isAdmin, secret, expiry, nil)
}

func GenerateAdminVerifiedAccessToken(userID uuid.UUID, email, username string, isAdmin bool, secret string, expiry time.Duration, verifiedAt time.Time) (string, error) {
	return generateAccessToken(userID, email, username, isAdmin, secret, expiry, &verifiedAt)
}

func generateAccessToken(userID uuid.UUID, email, username string, isAdmin bool, secret string, expiry time.Duration, adminMFAVerifiedAt *time.Time) (string, error) {
	claims := &Claims{
		UserID:    userID,
		Email:     email,
		Username:  username,
		IsAdmin:   isAdmin,
		TokenType: "access",
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        uuid.New().String(),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(expiry)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
			Issuer:    Issuer,
			Audience:  []string{Audience},
		},
	}
	if adminMFAVerifiedAt != nil {
		claims.AdminMFAVerifiedAt = jwt.NewNumericDate(*adminMFAVerifiedAt)
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

// GenerateRefreshToken creates a new JWT refresh token
func GenerateRefreshToken(userID uuid.UUID, secret string, expiry time.Duration) (string, error) {
	claims := &Claims{
		UserID:    userID,
		TokenType: "refresh",
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        uuid.New().String(),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(expiry)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    Issuer,
			Audience:  []string{Audience},
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

// ValidateToken validates a JWT token and returns the claims
func ValidateToken(tokenString, secret string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, ErrInvalidToken
		}
		return []byte(secret), nil
	})

	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, ErrInvalidToken
	}
	audienceValid := false
	for _, audience := range claims.Audience {
		if audience == Audience {
			audienceValid = true
			break
		}
	}
	if claims.Issuer != Issuer || !audienceValid {
		return nil, ErrInvalidToken
	}

	if time.Now().After(claims.ExpiresAt.Time) {
		return nil, ErrExpiredToken
	}

	return claims, nil
}
