package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/auth"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/config"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/mfa"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/testutil"
)

type fakeIdentityVerifier struct {
	identity *auth.SocialIdentity
	err      error
}

func (f *fakeIdentityVerifier) ProviderAvailable(provider string) bool { return provider == "apple" }
func (f *fakeIdentityVerifier) Verify(_ context.Context, _, _, _ string) (*auth.SocialIdentity, error) {
	return f.identity, f.err
}
func (f *fakeIdentityVerifier) VerifyGoogleAuthorizationCode(_ context.Context, _, _, _ string) (*auth.SocialIdentity, error) {
	return f.identity, f.err
}

type oauthHarness struct {
	t      *testing.T
	r      http.Handler
	userID uuid.UUID
}

func (h *oauthHarness) call(method, path string, body map[string]any, want int) map[string]any {
	h.t.Helper()
	data, err := json.Marshal(body)
	if err != nil {
		h.t.Fatal(err)
	}
	req := httptest.NewRequest(method, path, bytes.NewReader(data))
	req.Header.Set("Content-Type", "application/json")
	result := httptest.NewRecorder()
	h.r.ServeHTTP(result, req)
	if result.Code != want {
		h.t.Fatalf("%s %s: %d, want %d: %s", method, path, result.Code, want, result.Body.String())
	}
	if result.Body.Len() == 0 {
		return nil
	}
	var payload map[string]any
	if err := json.Unmarshal(result.Body.Bytes(), &payload); err != nil {
		h.t.Fatal(err)
	}
	return payload
}

func TestOAuthHandlerContractWithFakeProviders(t *testing.T) {
	db := testutil.OpenPostGIS(t)
	gin.SetMode(gin.TestMode)
	cfg := config.Load()
	cfg.JWT.Secret = "oauth-contract-integration-secret"
	cfg.JWT.MFAEncryptionKey = ""
	cfg.JWT.AccessExpiry = 15 * time.Minute
	cfg.JWT.RefreshExpiry = 24 * time.Hour
	cfg.OAuth.GoogleServerClientID = "fake-web-client"
	cfg.OAuth.GoogleClientSecret = "fake-server-secret"
	cfg.OAuth.ChallengeExpiry = 5 * time.Minute
	cfg.OAuth.LinkReauthExpiry = 5 * time.Minute
	handler := NewAuthHandler(db, cfg)
	identity := &auth.SocialIdentity{Provider: "google", Subject: uuid.NewString(), Email: "oauth-e2e-" + uuid.NewString() + "@example.invalid", Name: "Driver"}
	fake := &fakeIdentityVerifier{identity: identity}
	handler.oidc = fake
	h := &oauthHarness{t: t}
	r := gin.New()
	r.POST("/sign-in", handler.OAuthSignIn)
	r.POST("/register", handler.Register)
	r.POST("/challenge", handler.CreateOAuthChallenge)
	protected := r.Group("/")
	protected.Use(func(c *gin.Context) { c.Set("user_id", h.userID); c.Next() })
	protected.GET("/identities", handler.ListOAuthIdentities)
	protected.POST("/identities", handler.LinkOAuthIdentity)
	protected.POST("/reauth", handler.ReauthenticateForOAuthLink)
	h.r = r

	t.Run("provider validation and social-first sign-in", func(t *testing.T) {
		h.t = t
		h.call("POST", "/sign-in", map[string]any{"provider": "unknown", "authorization_code": "code"}, http.StatusBadRequest)
		h.call("POST", "/sign-in", map[string]any{"provider": "google", "identity_token": "wrong-shape"}, http.StatusBadRequest)
		first := h.call("POST", "/sign-in", map[string]any{"provider": "google", "authorization_code": "one-time-code"}, http.StatusOK)
		user := first["user"].(map[string]any)
		id, err := uuid.Parse(user["id"].(string))
		if err != nil {
			t.Fatal(err)
		}
		h.userID = id
		t.Cleanup(func() {
			if _, err := db.Exec(`DELETE FROM users WHERE id = $1`, id); err != nil {
				t.Error(err)
			}
		})
		if user["email"] != identity.Email || first["access_token"] == "" {
			t.Fatalf("social account not created: %#v", first)
		}
		second := h.call("POST", "/sign-in", map[string]any{"provider": "google", "authorization_code": "another-code"}, http.StatusOK)
		if second["user"].(map[string]any)["id"] != user["id"] {
			t.Fatal("same provider subject created another account")
		}
		methods := h.call("GET", "/identities", nil, http.StatusOK)
		if methods["password_available"] != false || len(methods["identities"].([]any)) != 1 {
			t.Fatalf("linked methods incorrect: %#v", methods)
		}
		fake.err = auth.ErrInvalidExternalIdentityToken
		h.call("POST", "/sign-in", map[string]any{"provider": "google", "authorization_code": "bad"}, http.StatusUnauthorized)
		fake.err = auth.ErrProviderUnavailable
		h.call("POST", "/sign-in", map[string]any{"provider": "google", "authorization_code": "down"}, http.StatusServiceUnavailable)
		fake.err = nil
		fake.identity = &auth.SocialIdentity{Provider: "google", Subject: uuid.NewString()}
		h.call("POST", "/sign-in", map[string]any{"provider": "google", "authorization_code": "missing-email"}, http.StatusUnprocessableEntity)
	})

	t.Run("Apple challenge is single-use", func(t *testing.T) {
		h.t = t
		fake.identity = &auth.SocialIdentity{Provider: "apple", Subject: uuid.NewString(), Email: "oauth-e2e-" + uuid.NewString() + "@example.invalid"}
		challenge := h.call("POST", "/challenge", map[string]any{"provider": "apple"}, http.StatusCreated)
		nonce := challenge["nonce"].(string)
		body := map[string]any{"provider": "apple", "identity_token": "signed-by-fake", "nonce": nonce}
		first := h.call("POST", "/sign-in", body, http.StatusOK)
		id := first["user"].(map[string]any)["id"].(string)
		t.Cleanup(func() {
			if _, err := db.Exec(`DELETE FROM users WHERE id = $1`, id); err != nil {
				t.Error(err)
			}
		})
		h.call("POST", "/sign-in", body, http.StatusUnauthorized)
		h.call("POST", "/challenge", map[string]any{"provider": "google"}, http.StatusBadRequest)
	})

	t.Run("password proof is required and consumed when linking", func(t *testing.T) {
		h.t = t
		name := "link" + uuid.NewString()[:12]
		account := h.call("POST", "/register", map[string]any{"email": name + "@example.invalid", "username": name, "password": "Test-password-123!"}, http.StatusCreated)
		id, err := uuid.Parse(account["user"].(map[string]any)["id"].(string))
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() {
			if _, err := db.Exec(`DELETE FROM users WHERE id = $1`, id); err != nil {
				t.Error(err)
			}
		})
		h.userID = id
		fake.identity = &auth.SocialIdentity{Provider: "google", Subject: uuid.NewString(), Email: name + "@example.invalid"}
		h.call("POST", "/identities", map[string]any{"provider": "google", "authorization_code": "code"}, http.StatusPreconditionRequired)
		h.call("POST", "/reauth", map[string]any{"password": "wrong-password"}, http.StatusUnauthorized)
		proof := h.call("POST", "/reauth", map[string]any{"password": "Test-password-123!"}, http.StatusOK)
		token := proof["reauthentication_token"].(string)
		body := map[string]any{"provider": "google", "authorization_code": "code", "reauthentication_token": token}
		h.call("POST", "/identities", body, http.StatusOK)
		linkedSubject := fake.identity.Subject
		h.call("POST", "/reauth", map[string]any{"password": "Test-password-123!", "provider": "google", "authorization_code": "ambiguous"}, http.StatusBadRequest)
		h.call("POST", "/reauth", map[string]any{}, http.StatusBadRequest)
		methods := h.call("GET", "/identities", nil, http.StatusOK)
		if methods["password_available"] != true || len(methods["identities"].([]any)) != 1 {
			t.Fatalf("link was not saved: %#v", methods)
		}
		h.call("POST", "/identities", body, http.StatusPreconditionRequired)
		linkedProof := h.call("POST", "/reauth", map[string]any{"provider": "google", "authorization_code": "linked-credential"}, http.StatusOK)
		body["reauthentication_token"] = linkedProof["reauthentication_token"]
		h.call("POST", "/identities", body, http.StatusOK)
		fake.identity = &auth.SocialIdentity{Provider: "google", Subject: uuid.NewString(), Email: name + "@example.invalid"}
		h.call("POST", "/sign-in", map[string]any{"provider": "google", "authorization_code": "unlinked-identity"}, http.StatusConflict)

		secret, err := mfa.GenerateSecret()
		if err != nil {
			t.Fatal(err)
		}
		encrypted, err := mfa.EncryptSecret(secret, cfg.JWT.Secret)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := db.Exec(`UPDATE users SET mfa_enabled = true, mfa_secret_encrypted = $2 WHERE id = $1`, id, encrypted); err != nil {
			t.Fatal(err)
		}
		h.call("POST", "/reauth", map[string]any{"password": "Test-password-123!"}, http.StatusPreconditionRequired)
		h.call("POST", "/reauth", map[string]any{"password": "Test-password-123!", "mfa_code": "INVALID-CODE"}, http.StatusUnauthorized)
		code, err := mfa.Code(secret, time.Now())
		if err != nil {
			t.Fatal(err)
		}
		h.call("POST", "/reauth", map[string]any{"password": "Test-password-123!", "mfa_code": code}, http.StatusOK)

		otherName := "link" + uuid.NewString()[:12]
		other := h.call("POST", "/register", map[string]any{"email": otherName + "@example.invalid", "username": otherName, "password": "Test-password-123!"}, http.StatusCreated)
		otherID, err := uuid.Parse(other["user"].(map[string]any)["id"].(string))
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() {
			if _, err := db.Exec(`DELETE FROM users WHERE id = $1`, otherID); err != nil {
				t.Error(err)
			}
		})
		h.userID = otherID
		fake.identity = &auth.SocialIdentity{Provider: "google", Subject: linkedSubject, Email: name + "@example.invalid"}
		otherProof := h.call("POST", "/reauth", map[string]any{"password": "Test-password-123!"}, http.StatusOK)
		h.call("POST", "/identities", map[string]any{
			"provider": "google", "authorization_code": "already-linked", "reauthentication_token": otherProof["reauthentication_token"],
		}, http.StatusConflict)
	})
}
