package handlers

import (
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"errors"
	"net/http"
	"net/mail"
	"strings"
	"time"
	"unicode"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/auth"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/database"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/mfa"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/models"
)

const socialUserColumns = `
	id, email, username, full_name, karma_points, notifications_enabled,
	enforcement_alerts_enabled, parking_radius_miles,
	notification_radius_meters, ask_about_enforcement_after_parking,
	announce_open_spot_after_unparking, email_verified, is_active, is_admin,
	mfa_enabled, created_at, updated_at, last_login_at`

const qualifiedSocialUserColumns = `
	users.id, users.email, users.username, users.full_name, users.karma_points, users.notifications_enabled,
	users.enforcement_alerts_enabled, users.parking_radius_miles,
	users.notification_radius_meters, users.ask_about_enforcement_after_parking,
	users.announce_open_spot_after_unparking, users.email_verified, users.is_active, users.is_admin,
	users.mfa_enabled, users.created_at, users.updated_at, users.last_login_at`

type OAuthChallengeRequest struct {
	Provider string `json:"provider"`
}

type OAuthCredentialRequest struct {
	Provider          string `json:"provider"`
	IdentityToken     string `json:"identity_token"`
	AuthorizationCode string `json:"authorization_code"`
	Nonce             string `json:"nonce"`
	FullName          string `json:"full_name"`
	ReauthToken       string `json:"reauthentication_token"`
}

type OAuthReauthenticationRequest struct {
	Password          string `json:"password"`
	MFACode           string `json:"mfa_code"`
	Provider          string `json:"provider"`
	IdentityToken     string `json:"identity_token"`
	AuthorizationCode string `json:"authorization_code"`
	Nonce             string `json:"nonce"`
}

type OAuthChallengeResponse struct {
	Provider  string    `json:"provider"`
	Nonce     string    `json:"nonce"`
	ExpiresAt time.Time `json:"expires_at"`
}

type LinkedIdentity struct {
	Provider    string    `json:"provider" db:"provider"`
	ConnectedAt time.Time `json:"connected_at" db:"connected_at"`
}

type LinkedIdentitiesResponse struct {
	Identities        []LinkedIdentity `json:"identities"`
	PasswordAvailable bool             `json:"password_available"`
}

type OAuthReauthenticationResponse struct {
	ReauthToken string    `json:"reauthentication_token"`
	ExpiresAt   time.Time `json:"expires_at"`
}

// CreateOAuthChallenge issues a short-lived nonce for the native Apple flow.
// Google uses an SDK-issued one-time server authorization code instead, so it
// does not need a separate nonce endpoint.
func (h *AuthHandler) CreateOAuthChallenge(c *gin.Context) {
	var req OAuthChallengeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		BadRequest(c, "invalid_oauth_request", "A supported sign-in provider is required")
		return
	}
	provider := normalizeOAuthProvider(req.Provider)
	if provider != "apple" {
		BadRequest(c, "oauth_challenge_not_supported", "This provider does not use a sign-in challenge")
		return
	}
	if !h.oidc.ProviderAvailable(provider) {
		Error(c, http.StatusServiceUnavailable, "social_sign_in_unavailable", "Apple sign-in is not configured on this server")
		return
	}

	nonce, err := newOAuthNonce()
	if err != nil {
		Error(c, http.StatusInternalServerError, "oauth_challenge_failed", "Unable to start sign-in")
		return
	}
	expiresAt := time.Now().UTC().Add(h.cfg.OAuth.ChallengeExpiry)
	if _, err := h.db.ExecContext(c.Request.Context(), `
		INSERT INTO oauth_challenges (provider, nonce_hash, expires_at)
		VALUES ($1, $2, $3)
	`, provider, auth.HashToken(nonce), expiresAt); err != nil {
		Error(c, http.StatusInternalServerError, "oauth_challenge_failed", "Unable to start sign-in")
		return
	}
	// Keep the table bounded without retaining expired sign-in attempts.
	// Failure here is harmless to the request.
	_, _ = h.db.ExecContext(c.Request.Context(), `
		DELETE FROM oauth_challenges
		WHERE expires_at < CURRENT_TIMESTAMP
	`)
	c.JSON(http.StatusCreated, OAuthChallengeResponse{Provider: provider, Nonce: nonce, ExpiresAt: expiresAt})
}

// OAuthSignIn creates a new social-first account or signs in through an
// already linked Google/Apple identity. It intentionally refuses to infer a
// link from an email match; an existing account must link a provider while
// authenticated via LinkOAuthIdentity.
func (h *AuthHandler) OAuthSignIn(c *gin.Context) {
	var req OAuthCredentialRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		BadRequest(c, "invalid_oauth_request", "A complete sign-in credential is required")
		return
	}
	identity, ok := h.verifyOAuthCredential(c, req)
	if !ok {
		return
	}

	tx, err := h.db.BeginTxx(c.Request.Context(), nil)
	if err != nil {
		Error(c, http.StatusInternalServerError, "social_sign_in_failed", "Unable to sign in right now")
		return
	}
	defer tx.Rollback()

	if identity.Provider == "apple" && !consumeOAuthChallenge(c, tx, identity.Provider, req.Nonce) {
		return
	}

	user, err := findUserByOAuthIdentity(c, tx, identity)
	if err == sql.ErrNoRows {
		user, err = h.createUserForOAuthIdentity(c, tx, identity)
		if err != nil {
			return
		}
		if _, err = tx.ExecContext(c.Request.Context(), `
			INSERT INTO oauth_identities (user_id, provider, provider_subject)
			VALUES ($1, $2, $3)
		`, user.ID, identity.Provider, identity.Subject); err != nil {
			if database.IsUniqueViolation(err) {
				Error(c, http.StatusConflict, "social_identity_conflict", "This sign-in method is already linked to another account")
				return
			}
			Error(c, http.StatusInternalServerError, "social_sign_in_failed", "Unable to sign in right now")
			return
		}
	} else if err != nil {
		Error(c, http.StatusInternalServerError, "social_sign_in_failed", "Unable to sign in right now")
		return
	} else {
		if !user.IsActive {
			Error(c, http.StatusUnauthorized, "invalid_credentials", "Unable to sign in with this account")
			return
		}
		if _, err = tx.ExecContext(c.Request.Context(), `
			UPDATE oauth_identities SET last_used_at = CURRENT_TIMESTAMP
			WHERE provider = $1 AND provider_subject = $2
		`, identity.Provider, identity.Subject); err != nil {
			Error(c, http.StatusInternalServerError, "social_sign_in_failed", "Unable to sign in right now")
			return
		}
	}
	if _, err = tx.ExecContext(c.Request.Context(), `
		UPDATE users SET last_login_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1
	`, user.ID); err != nil {
		Error(c, http.StatusInternalServerError, "social_sign_in_failed", "Unable to sign in right now")
		return
	}

	response, err := h.authResponseForUserTx(c, tx, user)
	if err != nil {
		Error(c, http.StatusInternalServerError, "social_sign_in_failed", "Unable to sign in right now")
		return
	}
	if err := tx.Commit(); err != nil {
		Error(c, http.StatusInternalServerError, "social_sign_in_failed", "Unable to sign in right now")
		return
	}
	c.JSON(http.StatusOK, response)
}

// ListOAuthIdentities returns connection metadata only. Immutable provider
// subjects and provider tokens never leave the server.
func (h *AuthHandler) ListOAuthIdentities(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	identities := make([]LinkedIdentity, 0, 2)
	if err := h.db.SelectContext(c.Request.Context(), &identities, `
		SELECT provider, connected_at
		FROM oauth_identities
		WHERE user_id = $1
		ORDER BY provider ASC
	`, userID); err != nil {
		Error(c, http.StatusInternalServerError, "linked_identities_unavailable", "Unable to load sign-in methods")
		return
	}
	var passwordAvailable bool
	if err := h.db.GetContext(c.Request.Context(), &passwordAvailable, `
		SELECT password_hash IS NOT NULL FROM users WHERE id = $1 AND is_active = true
	`, userID); err != nil {
		Error(c, http.StatusInternalServerError, "linked_identities_unavailable", "Unable to load sign-in methods")
		return
	}
	c.JSON(http.StatusOK, LinkedIdentitiesResponse{
		Identities:        identities,
		PasswordAvailable: passwordAvailable,
	})
}

// ReauthenticateForOAuthLink verifies a fresh credential for the current
// Park Opticon account before a durable new sign-in method can be attached.
// Possession of an ordinary access token is intentionally not sufficient.
func (h *AuthHandler) ReauthenticateForOAuthLink(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	var req OAuthReauthenticationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		BadRequest(c, "invalid_reauthentication_request", "A current password or linked sign-in method is required")
		return
	}

	// Passwords are opaque credentials. Do not trim them: the login endpoint
	// preserves leading/trailing spaces, and reauthentication must match it.
	password := req.Password
	hasProviderCredential := strings.TrimSpace(req.Provider) != "" || strings.TrimSpace(req.IdentityToken) != "" || strings.TrimSpace(req.AuthorizationCode) != "" || strings.TrimSpace(req.Nonce) != ""
	if len(password) > 72 || len(req.MFACode) > 64 {
		BadRequest(c, "invalid_reauthentication_request", "The reauthentication details are invalid")
		return
	}
	if (password == "" && !hasProviderCredential) || (password != "" && hasProviderCredential) {
		BadRequest(c, "invalid_reauthentication_request", "Use either your current password or an already linked sign-in method")
		return
	}

	var identity *auth.SocialIdentity
	if hasProviderCredential {
		var ok bool
		identity, ok = h.verifyOAuthCredential(c, OAuthCredentialRequest{
			Provider:          req.Provider,
			IdentityToken:     req.IdentityToken,
			AuthorizationCode: req.AuthorizationCode,
			Nonce:             req.Nonce,
		})
		if !ok {
			return
		}
	}

	tx, err := h.db.BeginTxx(c.Request.Context(), nil)
	if err != nil {
		Error(c, http.StatusInternalServerError, "reauthentication_failed", "Unable to confirm your account")
		return
	}
	defer tx.Rollback()

	if identity == nil {
		var passwordHash *string
		if err := tx.GetContext(c.Request.Context(), &passwordHash, `
			SELECT password_hash FROM users WHERE id = $1 AND is_active = true FOR UPDATE
		`, userID); err != nil {
			Error(c, http.StatusUnauthorized, "reauthentication_failed", "Unable to confirm your account")
			return
		}
		if passwordHash == nil || auth.CheckPassword(password, *passwordHash) != nil {
			Error(c, http.StatusUnauthorized, "reauthentication_failed", "Unable to confirm your account")
			return
		}
	} else {
		if identity.Provider == "apple" && !consumeOAuthChallenge(c, tx, identity.Provider, req.Nonce) {
			return
		}
		var linked bool
		if err := tx.GetContext(c.Request.Context(), &linked, `
			SELECT EXISTS(
				SELECT 1 FROM oauth_identities
				WHERE user_id = $1 AND provider = $2 AND provider_subject = $3
			)
		`, userID, identity.Provider, identity.Subject); err != nil {
			Error(c, http.StatusInternalServerError, "reauthentication_failed", "Unable to confirm your account")
			return
		}
		if !linked {
			Error(c, http.StatusForbidden, "reauthentication_identity_not_linked", "Use a sign-in method already linked to this account")
			return
		}
	}

	if !h.verifyOAuthLinkMFA(c, tx, userID, req.MFACode) {
		return
	}
	reauthToken, err := newOAuthNonce()
	if err != nil {
		Error(c, http.StatusInternalServerError, "reauthentication_failed", "Unable to confirm your account")
		return
	}
	expiresAt := time.Now().UTC().Add(h.cfg.OAuth.LinkReauthExpiry)
	if _, err = tx.ExecContext(c.Request.Context(), `
		INSERT INTO oauth_link_reauth_tokens (user_id, token_hash, expires_at)
		VALUES ($1, $2, $3)
	`, userID, auth.HashToken(reauthToken), expiresAt); err != nil {
		Error(c, http.StatusInternalServerError, "reauthentication_failed", "Unable to confirm your account")
		return
	}
	if _, err = tx.ExecContext(c.Request.Context(), `
		DELETE FROM oauth_link_reauth_tokens WHERE expires_at < CURRENT_TIMESTAMP
	`); err != nil {
		Error(c, http.StatusInternalServerError, "reauthentication_failed", "Unable to confirm your account")
		return
	}
	if err = tx.Commit(); err != nil {
		Error(c, http.StatusInternalServerError, "reauthentication_failed", "Unable to confirm your account")
		return
	}
	c.JSON(http.StatusOK, OAuthReauthenticationResponse{ReauthToken: reauthToken, ExpiresAt: expiresAt})
}

// LinkOAuthIdentity attaches a verified external identity to the currently
// authenticated Park Opticon account after consuming a fresh one-time
// reauthentication proof. It is idempotent for that same identity and rejects
// identities that belong to another account.
func (h *AuthHandler) LinkOAuthIdentity(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	var req OAuthCredentialRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		BadRequest(c, "invalid_oauth_request", "A complete sign-in credential is required")
		return
	}
	if len(req.ReauthToken) > 512 || strings.TrimSpace(req.ReauthToken) == "" {
		Error(c, http.StatusPreconditionRequired, "reauthentication_required", "Confirm your account before linking a new sign-in method")
		return
	}
	identity, ok := h.verifyOAuthCredential(c, req)
	if !ok {
		return
	}

	tx, err := h.db.BeginTxx(c.Request.Context(), nil)
	if err != nil {
		Error(c, http.StatusInternalServerError, "identity_link_failed", "Unable to link this sign-in method")
		return
	}
	defer tx.Rollback()
	if !consumeOAuthLinkReauthToken(c, tx, userID, req.ReauthToken) {
		return
	}
	if identity.Provider == "apple" && !consumeOAuthChallenge(c, tx, identity.Provider, req.Nonce) {
		return
	}

	var linked struct {
		UserID      uuid.UUID `db:"user_id"`
		ConnectedAt time.Time `db:"connected_at"`
	}
	created := false
	err = tx.GetContext(c.Request.Context(), &linked, `
		SELECT user_id, connected_at
		FROM oauth_identities
		WHERE provider = $1 AND provider_subject = $2
		FOR UPDATE
	`, identity.Provider, identity.Subject)
	if err == nil {
		if linked.UserID != userID {
			Error(c, http.StatusConflict, "identity_already_linked", "This sign-in method is already linked to another account")
			return
		}
		if _, err = tx.ExecContext(c.Request.Context(), `
			UPDATE oauth_identities SET last_used_at = CURRENT_TIMESTAMP
			WHERE provider = $1 AND provider_subject = $2
		`, identity.Provider, identity.Subject); err != nil {
			Error(c, http.StatusInternalServerError, "identity_link_failed", "Unable to link this sign-in method")
			return
		}
	} else if err == sql.ErrNoRows {
		var existingSubject string
		err = tx.GetContext(c.Request.Context(), &existingSubject, `
			SELECT provider_subject FROM oauth_identities
			WHERE user_id = $1 AND provider = $2
			FOR UPDATE
		`, userID, identity.Provider)
		if err == nil {
			Error(c, http.StatusConflict, "provider_already_linked", "A different account from this provider is already linked")
			return
		}
		if err != sql.ErrNoRows {
			Error(c, http.StatusInternalServerError, "identity_link_failed", "Unable to link this sign-in method")
			return
		}
		if err = tx.GetContext(c.Request.Context(), &linked.ConnectedAt, `
			INSERT INTO oauth_identities (user_id, provider, provider_subject)
			VALUES ($1, $2, $3)
			RETURNING connected_at
		`, userID, identity.Provider, identity.Subject); err != nil {
			if database.IsUniqueViolation(err) {
				Error(c, http.StatusConflict, "identity_already_linked", "This sign-in method is already linked to another account")
				return
			}
			Error(c, http.StatusInternalServerError, "identity_link_failed", "Unable to link this sign-in method")
			return
		}
		created = true
	} else {
		Error(c, http.StatusInternalServerError, "identity_link_failed", "Unable to link this sign-in method")
		return
	}
	if created && !recordOAuthIdentityLink(c, tx, userID, identity.Provider) {
		return
	}

	if err = tx.Commit(); err != nil {
		Error(c, http.StatusInternalServerError, "identity_link_failed", "Unable to link this sign-in method")
		return
	}
	c.JSON(http.StatusOK, gin.H{"identity": LinkedIdentity{Provider: identity.Provider, ConnectedAt: linked.ConnectedAt}})
}

func (h *AuthHandler) verifyOAuthCredential(c *gin.Context, req OAuthCredentialRequest) (*auth.SocialIdentity, bool) {
	provider := normalizeOAuthProvider(req.Provider)
	if provider == "" {
		BadRequest(c, "unsupported_oauth_provider", "Choose Google or Apple")
		return nil, false
	}
	fullName := normalizeOAuthFullName(req.FullName)
	if len(req.IdentityToken) > 16*1024 || len(req.AuthorizationCode) > 4096 || len(req.Nonce) > 512 || len([]rune(fullName)) > 100 {
		BadRequest(c, "invalid_oauth_request", "The sign-in credential is invalid")
		return nil, false
	}

	var (
		identity *auth.SocialIdentity
		err      error
	)
	switch provider {
	case "google":
		if strings.TrimSpace(req.AuthorizationCode) == "" || strings.TrimSpace(req.IdentityToken) != "" || strings.TrimSpace(req.Nonce) != "" {
			BadRequest(c, "invalid_oauth_request", "A Google authorization code is required")
			return nil, false
		}
		identity, err = h.oidc.VerifyGoogleAuthorizationCode(
			c.Request.Context(),
			req.AuthorizationCode,
			h.cfg.OAuth.GoogleServerClientID,
			h.cfg.OAuth.GoogleClientSecret,
		)
	case "apple":
		if strings.TrimSpace(req.IdentityToken) == "" || strings.TrimSpace(req.AuthorizationCode) != "" || strings.TrimSpace(req.Nonce) == "" {
			BadRequest(c, "invalid_oauth_request", "An Apple identity token and sign-in challenge are required")
			return nil, false
		}
		identity, err = h.oidc.Verify(c.Request.Context(), provider, req.IdentityToken, req.Nonce)
	}
	if err == nil {
		// Apple supplies a person's name outside the signed identity token and
		// only on the first grant. It is harmless display metadata (not an
		// authorization claim), so preserve it only when the token itself did
		// not include a name and only for new-account creation below.
		if identity.Name == "" {
			identity.Name = fullName
		}
		return identity, true
	}
	if errors.Is(err, auth.ErrProviderUnavailable) || errors.Is(err, auth.ErrIdentityVerificationFailed) {
		Error(c, http.StatusServiceUnavailable, "social_sign_in_unavailable", "This sign-in provider is temporarily unavailable")
		return nil, false
	}
	Error(c, http.StatusUnauthorized, "social_credential_invalid", "Unable to verify this sign-in credential")
	return nil, false
}

func findUserByOAuthIdentity(c *gin.Context, tx *sqlx.Tx, identity *auth.SocialIdentity) (*models.User, error) {
	user := &models.User{}
	err := tx.GetContext(c.Request.Context(), user, `
		SELECT `+qualifiedSocialUserColumns+`
		FROM oauth_identities identities
		JOIN users ON users.id = identities.user_id
		WHERE identities.provider = $1 AND identities.provider_subject = $2
		FOR UPDATE OF identities, users
	`, identity.Provider, identity.Subject)
	return user, err
}

func (h *AuthHandler) createUserForOAuthIdentity(c *gin.Context, tx *sqlx.Tx, identity *auth.SocialIdentity) (*models.User, error) {
	email := strings.ToLower(strings.TrimSpace(identity.Email))
	if !isValidOAuthEmail(email) {
		Error(c, http.StatusUnprocessableEntity, "identity_email_required", "Allow your provider to share a verified email address to create an account")
		return nil, errors.New("provider did not supply a usable email")
	}
	var existing bool
	if err := tx.GetContext(c.Request.Context(), &existing, `
		SELECT EXISTS(SELECT 1 FROM users WHERE lower(email) = $1)
	`, email); err != nil {
		Error(c, http.StatusInternalServerError, "social_sign_in_failed", "Unable to sign in right now")
		return nil, err
	}
	if existing {
		Error(c, http.StatusConflict, "account_link_required", "Sign in to your existing Park Opticon account, then connect this provider from Account")
		return nil, errors.New("existing account requires explicit link")
	}

	username := identity.Provider + "_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	var fullName interface{}
	if name := strings.TrimSpace(identity.Name); name != "" {
		fullName = name
	}
	user := &models.User{}
	err := tx.QueryRowxContext(c.Request.Context(), `
		INSERT INTO users (email, password_hash, username, full_name, email_verified)
		VALUES ($1, NULL, $2, $3, true)
		RETURNING `+socialUserColumns, email, username, fullName).StructScan(user)
	if err != nil {
		if database.IsUniqueViolation(err) {
			Error(c, http.StatusConflict, "account_conflict", "Unable to create an account with this sign-in method")
		} else {
			Error(c, http.StatusInternalServerError, "social_sign_in_failed", "Unable to sign in right now")
		}
		return nil, err
	}
	return user, nil
}

func (h *AuthHandler) authResponseForUserTx(c *gin.Context, tx *sqlx.Tx, user *models.User) (*AuthResponse, error) {
	accessToken, err := auth.GenerateAccessToken(
		user.ID, user.Email, user.Username, user.IsAdmin,
		h.cfg.JWT.Secret, h.cfg.JWT.AccessExpiry,
	)
	if err != nil {
		return nil, err
	}
	refreshToken, err := auth.GenerateRefreshToken(user.ID, h.cfg.JWT.Secret, h.cfg.JWT.RefreshExpiry)
	if err != nil {
		return nil, err
	}
	if _, err = tx.ExecContext(c.Request.Context(), `
		INSERT INTO user_sessions (
			user_id, refresh_token_hash, token_family_id, expires_at, ip_address, device_info
		)
		VALUES ($1, $2, gen_random_uuid(), $3, $4, $5)
	`, user.ID, auth.HashToken(refreshToken), time.Now().UTC().Add(h.cfg.JWT.RefreshExpiry), c.ClientIP(), c.Request.UserAgent()); err != nil {
		return nil, err
	}
	user.Password = nil
	return &AuthResponse{AccessToken: accessToken, RefreshToken: refreshToken, User: user}, nil
}

func consumeOAuthChallenge(c *gin.Context, tx *sqlx.Tx, provider, nonce string) bool {
	var id uuid.UUID
	err := tx.GetContext(c.Request.Context(), &id, `
		UPDATE oauth_challenges
		SET used_at = CURRENT_TIMESTAMP
		WHERE provider = $1
		  AND nonce_hash = $2
		  AND used_at IS NULL
		  AND expires_at > CURRENT_TIMESTAMP
		RETURNING id
	`, provider, auth.HashToken(nonce))
	if err == nil {
		return true
	}
	if err == sql.ErrNoRows {
		Error(c, http.StatusUnauthorized, "oauth_challenge_invalid", "This sign-in request has expired. Please try again")
		return false
	}
	Error(c, http.StatusInternalServerError, "oauth_challenge_failed", "Unable to complete sign-in")
	return false
}

func consumeOAuthLinkReauthToken(c *gin.Context, tx *sqlx.Tx, userID uuid.UUID, rawToken string) bool {
	var id uuid.UUID
	err := tx.GetContext(c.Request.Context(), &id, `
		UPDATE oauth_link_reauth_tokens
		SET used_at = CURRENT_TIMESTAMP
		WHERE user_id = $1
		  AND token_hash = $2
		  AND used_at IS NULL
		  AND expires_at > CURRENT_TIMESTAMP
		RETURNING id
	`, userID, auth.HashToken(rawToken))
	if err == nil {
		return true
	}
	if err == sql.ErrNoRows {
		Error(c, http.StatusPreconditionRequired, "reauthentication_required", "Confirm your account again before linking a sign-in method")
		return false
	}
	Error(c, http.StatusInternalServerError, "identity_link_failed", "Unable to link this sign-in method")
	return false
}

func (h *AuthHandler) verifyOAuthLinkMFA(c *gin.Context, tx *sqlx.Tx, userID uuid.UUID, suppliedCode string) bool {
	var account struct {
		Enabled   bool   `db:"mfa_enabled"`
		Encrypted []byte `db:"mfa_secret_encrypted"`
	}
	if err := tx.GetContext(c.Request.Context(), &account, `
		SELECT COALESCE(mfa_enabled, false) AS mfa_enabled, mfa_secret_encrypted
		FROM users WHERE id = $1 AND is_active = true FOR UPDATE
	`, userID); err != nil {
		Error(c, http.StatusUnauthorized, "reauthentication_failed", "Unable to confirm your account")
		return false
	}
	if !account.Enabled {
		return true
	}

	code := strings.TrimSpace(suppliedCode)
	if code == "" {
		Error(c, http.StatusPreconditionRequired, "reauthentication_mfa_required", "Enter your authenticator or recovery code to continue")
		return false
	}
	if len(account.Encrypted) > 0 && mfa.ValidateCodeFormat(code) {
		secret, err := mfa.DecryptSecret(account.Encrypted, h.mfaKeyMaterial())
		if err == nil && mfa.VerifyCode(secret, code, time.Now().UTC()) {
			return true
		}
	}
	result, err := tx.ExecContext(c.Request.Context(), `
		UPDATE user_mfa_recovery_codes
		SET used_at = CURRENT_TIMESTAMP
		WHERE user_id = $1 AND code_hash = $2 AND used_at IS NULL
	`, userID, mfa.Hash(strings.ToUpper(code)))
	if err != nil {
		Error(c, http.StatusInternalServerError, "reauthentication_failed", "Unable to confirm your account")
		return false
	}
	rows, _ := result.RowsAffected()
	if rows == 1 {
		return true
	}
	Error(c, http.StatusUnauthorized, "reauthentication_failed", "Unable to confirm your account")
	return false
}

func (h *AuthHandler) mfaKeyMaterial() string {
	if h.cfg.JWT.MFAEncryptionKey != "" {
		return h.cfg.JWT.MFAEncryptionKey
	}
	return h.cfg.JWT.Secret
}

func recordOAuthIdentityLink(c *gin.Context, tx *sqlx.Tx, userID uuid.UUID, provider string) bool {
	if _, err := tx.ExecContext(c.Request.Context(), `
		INSERT INTO audit_logs (user_id, action, entity_type, ip_address, user_agent, request_data)
		VALUES ($1, 'oauth_identity_linked', 'oauth_identity', $2, $3, jsonb_build_object('provider', $4))
	`, userID, c.ClientIP(), c.Request.UserAgent(), provider); err != nil {
		Error(c, http.StatusInternalServerError, "identity_link_failed", "Unable to link this sign-in method")
		return false
	}
	if _, err := tx.ExecContext(c.Request.Context(), `
		INSERT INTO notifications (user_id, title, body, notification_type, status, sent_at)
		VALUES ($1, $2, $3, 'system', 'sent', CURRENT_TIMESTAMP)
	`, userID, providerName(provider)+" sign-in linked", "A new sign-in method was linked to your Park Opticon account."); err != nil {
		Error(c, http.StatusInternalServerError, "identity_link_failed", "Unable to link this sign-in method")
		return false
	}
	return true
}

func providerName(provider string) string {
	switch provider {
	case "google":
		return "Google"
	case "apple":
		return "Apple"
	default:
		return "External"
	}
}

func normalizeOAuthProvider(provider string) string {
	switch strings.ToLower(strings.TrimSpace(provider)) {
	case "google", "apple":
		return strings.ToLower(strings.TrimSpace(provider))
	default:
		return ""
	}
}

func newOAuthNonce() (string, error) {
	var bytes [32]byte
	if _, err := rand.Read(bytes[:]); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(bytes[:]), nil
}

func isValidOAuthEmail(email string) bool {
	address, err := mail.ParseAddress(email)
	return err == nil && address.Address == email && len(email) <= 255
}

func normalizeOAuthFullName(value string) string {
	value = strings.Map(func(r rune) rune {
		if unicode.IsControl(r) {
			return -1
		}
		return r
	}, value)
	return strings.TrimSpace(value)
}
