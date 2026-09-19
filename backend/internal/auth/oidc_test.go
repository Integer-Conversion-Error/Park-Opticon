package auth

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func TestOIDCVerifierVerifiesSignatureClaimsAndNonce(t *testing.T) {
	privateKey := newRSAKey(t)
	server := newJWKSHandler(t, privateKey, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/keys" {
			http.NotFound(w, r)
			return
		}
		writeJWKS(t, w, privateKey)
	})
	defer server.Close()

	verifier := newOIDCVerifier(map[string]oidcProvider{
		"google": {
			name:                 "google",
			issuers:              []string{"https://issuer.example"},
			audiences:            []string{"client-id"},
			jwksURL:              server.URL + "/keys",
			requireVerifiedEmail: true,
		},
	}, server.Client(), time.Hour)

	token := signedOIDCToken(t, privateKey, "https://issuer.example", "client-id", "google-user", "nonce-123")
	identity, err := verifier.Verify(context.Background(), "google", token, "nonce-123")
	if err != nil {
		t.Fatalf("Verify() error = %v", err)
	}
	if identity.Provider != "google" || identity.Subject != "google-user" || identity.Email != "driver@example.com" {
		t.Fatalf("unexpected identity: %#v", identity)
	}

	if _, err := verifier.Verify(context.Background(), "google", token, "different-nonce"); err != ErrInvalidExternalIdentityToken {
		t.Fatalf("wrong nonce error = %v, want %v", err, ErrInvalidExternalIdentityToken)
	}

	wrongAudience := signedOIDCToken(t, privateKey, "https://issuer.example", "another-client", "google-user", "nonce-123")
	if _, err := verifier.Verify(context.Background(), "google", wrongAudience, "nonce-123"); err != ErrInvalidExternalIdentityToken {
		t.Fatalf("wrong audience error = %v, want %v", err, ErrInvalidExternalIdentityToken)
	}
}

func TestOIDCVerifierExchangesGoogleServerAuthCode(t *testing.T) {
	privateKey := newRSAKey(t)
	server := newJWKSHandler(t, privateKey, func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/keys":
			writeJWKS(t, w, privateKey)
		case "/token":
			if err := r.ParseForm(); err != nil {
				t.Fatalf("ParseForm: %v", err)
			}
			if got, want := r.Form.Get("code"), "one-time-code"; got != want {
				t.Fatalf("code = %q, want %q", got, want)
			}
			if got, want := r.Form.Get("client_id"), "server-client"; got != want {
				t.Fatalf("client_id = %q, want %q", got, want)
			}
			if got, want := r.Form.Get("client_secret"), "server-secret"; got != want {
				t.Fatalf("client_secret = %q, want %q", got, want)
			}
			if got, want := r.Form.Get("redirect_uri"), ""; got != want {
				t.Fatalf("redirect_uri = %q, want empty", got)
			}
			_ = json.NewEncoder(w).Encode(map[string]string{
				"id_token": signedOIDCToken(t, privateKey, "https://issuer.example", "server-client", "google-user", ""),
			})
		default:
			http.NotFound(w, r)
		}
	})
	defer server.Close()

	verifier := newOIDCVerifier(map[string]oidcProvider{
		"google": {
			name:                 "google",
			issuers:              []string{"https://issuer.example"},
			audiences:            []string{"server-client"},
			jwksURL:              server.URL + "/keys",
			requireVerifiedEmail: true,
		},
	}, server.Client(), time.Hour)
	verifier.googleTokenURL = server.URL + "/token"

	identity, err := verifier.VerifyGoogleAuthorizationCode(context.Background(), "one-time-code", "server-client", "server-secret")
	if err != nil {
		t.Fatalf("VerifyGoogleAuthorizationCode() error = %v", err)
	}
	if identity.Subject != "google-user" || identity.Email != "driver@example.com" {
		t.Fatalf("unexpected identity: %#v", identity)
	}
}

func newRSAKey(t *testing.T) *rsa.PrivateKey {
	t.Helper()
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("GenerateKey: %v", err)
	}
	return privateKey
}

func newJWKSHandler(t *testing.T, privateKey *rsa.PrivateKey, handler http.HandlerFunc) *httptest.Server {
	t.Helper()
	return httptest.NewServer(handler)
}

func writeJWKS(t *testing.T, w http.ResponseWriter, privateKey *rsa.PrivateKey) {
	t.Helper()
	exponent := bigEndianBytes(privateKey.PublicKey.E)
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(map[string]any{
		"keys": []map[string]string{{
			"kid": "test-key",
			"kty": "RSA",
			"alg": "RS256",
			"use": "sig",
			"n":   base64.RawURLEncoding.EncodeToString(privateKey.PublicKey.N.Bytes()),
			"e":   base64.RawURLEncoding.EncodeToString(exponent),
		}},
	}); err != nil {
		t.Fatalf("encode JWKS: %v", err)
	}
}

func signedOIDCToken(t *testing.T, privateKey *rsa.PrivateKey, issuer, audience, subject, nonce string) string {
	t.Helper()
	now := time.Now()
	claims := jwt.MapClaims{
		"iss":            issuer,
		"aud":            audience,
		"sub":            subject,
		"email":          "DRIVER@example.com",
		"email_verified": "true",
		"iat":            now.Unix(),
		"exp":            now.Add(time.Minute).Unix(),
	}
	if nonce != "" {
		claims["nonce"] = nonce
	}
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	token.Header["kid"] = "test-key"
	encoded, err := token.SignedString(privateKey)
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}
	return encoded
}

func bigEndianBytes(value int) []byte {
	if value == 0 {
		return []byte{0}
	}
	bytes := make([]byte, 0, 8)
	for value > 0 {
		bytes = append([]byte{byte(value)}, bytes...)
		value >>= 8
	}
	return bytes
}
