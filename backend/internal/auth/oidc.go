package auth

import (
	"context"
	"crypto/rsa"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const (
	googleJWKSURL  = "https://www.googleapis.com/oauth2/v3/certs"
	appleJWKSURL   = "https://appleid.apple.com/auth/keys"
	googleTokenURL = "https://oauth2.googleapis.com/token"
)

var (
	ErrProviderUnavailable          = errors.New("external identity provider is unavailable")
	ErrInvalidExternalIdentityToken = errors.New("invalid external identity token")
	ErrEmailNotVerified             = errors.New("external identity email is not verified")
	ErrIdentityVerificationFailed   = errors.New("external identity verification failed")
)

// SocialIdentity contains values that were cryptographically asserted by a
// provider. It intentionally excludes a provider access token or refresh token
// because Park Opticon only needs an identity assertion to create its own
// session.
type SocialIdentity struct {
	Provider string
	Subject  string
	Email    string
	Name     string
}

type oidcProvider struct {
	name                 string
	issuers              []string
	audiences            []string
	jwksURL              string
	requireVerifiedEmail bool
}

type cachedJWKS struct {
	keys      map[string]*rsa.PublicKey
	expiresAt time.Time
}

// OIDCVerifier verifies Google and Apple identity tokens locally against the
// providers' public JWKS documents. It never relies on a tokeninfo endpoint
// or decoded-but-unverified claims.
type OIDCVerifier struct {
	providers      map[string]oidcProvider
	client         *http.Client
	cacheTTL       time.Duration
	now            func() time.Time
	googleTokenURL string

	mu    sync.Mutex
	cache map[string]cachedJWKS
}

// NewOIDCVerifier builds the production verifier. Empty client-ID lists leave
// that provider disabled so a deployment cannot accidentally accept an ID token
// for an unknown audience.
func NewOIDCVerifier(googleClientIDs, appleClientIDs []string, cacheTTL time.Duration) *OIDCVerifier {
	providers := map[string]oidcProvider{
		"google": {
			name:                 "google",
			issuers:              []string{"https://accounts.google.com", "accounts.google.com"},
			audiences:            cleanStrings(googleClientIDs),
			jwksURL:              googleJWKSURL,
			requireVerifiedEmail: true,
		},
		"apple": {
			name:                 "apple",
			issuers:              []string{"https://appleid.apple.com"},
			audiences:            cleanStrings(appleClientIDs),
			jwksURL:              appleJWKSURL,
			requireVerifiedEmail: false,
		},
	}
	return newOIDCVerifier(providers, nil, cacheTTL)
}

// newOIDCVerifier makes the remote JWKS endpoint injectable for unit tests.
func newOIDCVerifier(providers map[string]oidcProvider, client *http.Client, cacheTTL time.Duration) *OIDCVerifier {
	if client == nil {
		client = &http.Client{
			Timeout: 5 * time.Second,
			// Provider endpoints are fixed HTTPS origins. Do not follow a redirect
			// that could forward a Google client secret to another host.
			CheckRedirect: func(_ *http.Request, _ []*http.Request) error {
				return http.ErrUseLastResponse
			},
		}
	}
	if cacheTTL <= 0 {
		cacheTTL = 6 * time.Hour
	}
	return &OIDCVerifier{
		providers:      providers,
		client:         client,
		cacheTTL:       cacheTTL,
		now:            time.Now,
		googleTokenURL: googleTokenURL,
		cache:          make(map[string]cachedJWKS),
	}
}

func (v *OIDCVerifier) ProviderAvailable(provider string) bool {
	config, ok := v.providers[strings.ToLower(strings.TrimSpace(provider))]
	return ok && len(config.audiences) > 0
}

// Verify validates a provider token's signature, issuer, audience, lifetime,
// and server-issued nonce before returning a stable provider subject.
func (v *OIDCVerifier) Verify(ctx context.Context, provider, rawToken, expectedNonce string) (*SocialIdentity, error) {
	return v.verifyToken(ctx, provider, rawToken, expectedNonce, true)
}

// VerifyGoogleAuthorizationCode exchanges the one-time server auth code
// returned by the native Google SDK. Unlike an ID-token handoff, the code can
// be redeemed only once by this backend using its confidential Web-client
// secret, which supplies replay protection on Android without putting a secret
// or a paid nonce-capable SDK in the app.
func (v *OIDCVerifier) VerifyGoogleAuthorizationCode(ctx context.Context, code, serverClientID, clientSecret string) (*SocialIdentity, error) {
	config, ok := v.providers["google"]
	if !ok || len(config.audiences) == 0 || !contains(config.audiences, strings.TrimSpace(serverClientID)) || strings.TrimSpace(clientSecret) == "" {
		return nil, ErrProviderUnavailable
	}
	if strings.TrimSpace(code) == "" {
		return nil, ErrInvalidExternalIdentityToken
	}

	form := url.Values{
		"client_id":     {strings.TrimSpace(serverClientID)},
		"client_secret": {clientSecret},
		"code":          {strings.TrimSpace(code)},
		"grant_type":    {"authorization_code"},
		"redirect_uri":  {""},
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, v.googleTokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return nil, ErrIdentityVerificationFailed
	}
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	response, err := v.client.Do(request)
	if err != nil {
		return nil, ErrIdentityVerificationFailed
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		if response.StatusCode >= http.StatusInternalServerError {
			return nil, ErrIdentityVerificationFailed
		}
		return nil, ErrInvalidExternalIdentityToken
	}
	var payload struct {
		IDToken string `json:"id_token"`
	}
	if err := json.NewDecoder(io.LimitReader(response.Body, 1<<20)).Decode(&payload); err != nil || strings.TrimSpace(payload.IDToken) == "" {
		return nil, ErrIdentityVerificationFailed
	}
	return v.verifyToken(ctx, "google", payload.IDToken, "", false)
}

func (v *OIDCVerifier) verifyToken(ctx context.Context, provider, rawToken, expectedNonce string, requireNonce bool) (*SocialIdentity, error) {
	provider = strings.ToLower(strings.TrimSpace(provider))
	config, ok := v.providers[provider]
	if !ok || len(config.audiences) == 0 {
		return nil, ErrProviderUnavailable
	}
	if strings.TrimSpace(rawToken) == "" || (requireNonce && strings.TrimSpace(expectedNonce) == "") {
		return nil, ErrInvalidExternalIdentityToken
	}

	claims := &oidcClaims{}
	parsed, err := jwt.ParseWithClaims(
		rawToken,
		claims,
		func(token *jwt.Token) (interface{}, error) {
			kid, _ := token.Header["kid"].(string)
			if strings.TrimSpace(kid) == "" {
				return nil, ErrInvalidExternalIdentityToken
			}
			return v.publicKey(ctx, config.jwksURL, kid)
		},
		jwt.WithValidMethods([]string{jwt.SigningMethodRS256.Alg()}),
		jwt.WithExpirationRequired(),
		jwt.WithIssuedAt(),
		jwt.WithLeeway(time.Minute),
	)
	if err != nil {
		if errors.Is(err, ErrIdentityVerificationFailed) {
			return nil, ErrIdentityVerificationFailed
		}
		return nil, ErrInvalidExternalIdentityToken
	}
	if parsed == nil || !parsed.Valid || !contains(config.issuers, claims.Issuer) || !containsAny(claims.Audience, config.audiences) {
		return nil, ErrInvalidExternalIdentityToken
	}
	// OIDC requires azp when an ID token has more than one audience. Treat an
	// unexpected authorized party as invalid even for a single-audience token.
	if claims.AuthorizedParty != "" && !contains(config.audiences, claims.AuthorizedParty) {
		return nil, ErrInvalidExternalIdentityToken
	}
	if len(claims.Audience) > 1 && claims.AuthorizedParty == "" {
		return nil, ErrInvalidExternalIdentityToken
	}
	if strings.TrimSpace(claims.Subject) == "" || len(claims.Subject) > 255 {
		return nil, ErrInvalidExternalIdentityToken
	}
	if requireNonce && (strings.TrimSpace(claims.Nonce) == "" || subtle.ConstantTimeCompare([]byte(claims.Nonce), []byte(expectedNonce)) != 1) {
		return nil, ErrInvalidExternalIdentityToken
	}

	emailVerified, verificationPresent := claims.emailVerified()
	if config.requireVerifiedEmail && (!verificationPresent || !emailVerified) {
		return nil, ErrEmailNotVerified
	}
	if verificationPresent && !emailVerified {
		return nil, ErrEmailNotVerified
	}

	return &SocialIdentity{
		Provider: config.name,
		Subject:  claims.Subject,
		Email:    strings.ToLower(strings.TrimSpace(claims.Email)),
		Name:     strings.TrimSpace(claims.Name),
	}, nil
}

type oidcClaims struct {
	Email           string          `json:"email"`
	EmailVerified   json.RawMessage `json:"email_verified"`
	Name            string          `json:"name"`
	Nonce           string          `json:"nonce"`
	AuthorizedParty string          `json:"azp"`
	jwt.RegisteredClaims
}

func (c *oidcClaims) emailVerified() (value, present bool) {
	if len(c.EmailVerified) == 0 || string(c.EmailVerified) == "null" {
		return false, false
	}
	var boolValue bool
	if err := json.Unmarshal(c.EmailVerified, &boolValue); err == nil {
		return boolValue, true
	}
	var stringValue string
	if err := json.Unmarshal(c.EmailVerified, &stringValue); err == nil {
		switch strings.ToLower(strings.TrimSpace(stringValue)) {
		case "true":
			return true, true
		case "false":
			return false, true
		}
	}
	return false, false
}

func (v *OIDCVerifier) publicKey(ctx context.Context, jwksURL, kid string) (*rsa.PublicKey, error) {
	now := v.now()
	v.mu.Lock()
	set, exists := v.cache[jwksURL]
	if exists && now.Before(set.expiresAt) {
		if key, found := set.keys[kid]; found {
			v.mu.Unlock()
			return key, nil
		}
	}
	v.mu.Unlock()

	keys, err := v.fetchKeys(ctx, jwksURL)
	if err != nil {
		return nil, ErrIdentityVerificationFailed
	}
	v.mu.Lock()
	v.cache[jwksURL] = cachedJWKS{keys: keys, expiresAt: v.now().Add(v.cacheTTL)}
	key := keys[kid]
	v.mu.Unlock()
	if key == nil {
		return nil, ErrInvalidExternalIdentityToken
	}
	return key, nil
}

func (v *OIDCVerifier) fetchKeys(ctx context.Context, jwksURL string) (map[string]*rsa.PublicKey, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, jwksURL, nil)
	if err != nil {
		return nil, fmt.Errorf("build JWKS request: %w", err)
	}
	response, err := v.client.Do(request)
	if err != nil {
		return nil, fmt.Errorf("fetch JWKS: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("fetch JWKS: unexpected status %d", response.StatusCode)
	}

	var document jwksDocument
	decoder := json.NewDecoder(io.LimitReader(response.Body, 1<<20))
	if err := decoder.Decode(&document); err != nil {
		return nil, fmt.Errorf("decode JWKS: %w", err)
	}
	keys := make(map[string]*rsa.PublicKey, len(document.Keys))
	for _, item := range document.Keys {
		if item.KID == "" || item.KTY != "RSA" || (item.Alg != "" && item.Alg != "RS256") || (item.Use != "" && item.Use != "sig") {
			continue
		}
		key, err := item.publicKey()
		if err != nil {
			continue
		}
		keys[item.KID] = key
	}
	if len(keys) == 0 {
		return nil, errors.New("JWKS did not contain a usable RSA signing key")
	}
	return keys, nil
}

type jwksDocument struct {
	Keys []jwk `json:"keys"`
}

type jwk struct {
	KID string `json:"kid"`
	KTY string `json:"kty"`
	Alg string `json:"alg"`
	Use string `json:"use"`
	N   string `json:"n"`
	E   string `json:"e"`
}

func (key jwk) publicKey() (*rsa.PublicKey, error) {
	modulus, err := base64.RawURLEncoding.DecodeString(key.N)
	if err != nil {
		return nil, err
	}
	exponent, err := base64.RawURLEncoding.DecodeString(key.E)
	if err != nil {
		return nil, err
	}
	n := new(big.Int).SetBytes(modulus)
	e := new(big.Int).SetBytes(exponent)
	if n.BitLen() < 2048 || !e.IsInt64() || e.Int64() < 3 || e.Int64() > int64(^uint(0)>>1) {
		return nil, errors.New("invalid RSA JWK")
	}
	return &rsa.PublicKey{N: n, E: int(e.Int64())}, nil
}

func cleanStrings(values []string) []string {
	cleaned := make([]string, 0, len(values))
	for _, value := range values {
		if value = strings.TrimSpace(value); value != "" {
			cleaned = append(cleaned, value)
		}
	}
	return cleaned
}

func contains(values []string, expected string) bool {
	for _, value := range values {
		if value == expected {
			return true
		}
	}
	return false
}

func containsAny(values, expected []string) bool {
	for _, value := range values {
		if contains(expected, value) {
			return true
		}
	}
	return false
}
