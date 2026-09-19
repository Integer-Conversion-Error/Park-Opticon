package handlers

import (
	"database/sql"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/auth"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/config"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/mfa"
)

type MFAHandler struct {
	db  *sqlx.DB
	cfg *config.Config
}

func NewMFAHandler(db *sqlx.DB, cfg *config.Config) *MFAHandler {
	return &MFAHandler{db: db, cfg: cfg}
}

type MFACodeRequest struct {
	Code string `json:"code" binding:"required"`
}

type MFAStatusResponse struct {
	Enabled bool `json:"enabled"`
}

type MFAEnrollResponse struct {
	Secret          string `json:"secret"`
	OTPAuthURI      string `json:"otpauth_uri"`
	RequiresConfirm bool   `json:"requires_confirm"`
}

type MFAConfirmResponse struct {
	Enabled       bool     `json:"enabled"`
	RecoveryCodes []string `json:"recovery_codes"`
}

type MFAVerifyResponse struct {
	AccessToken string    `json:"access_token"`
	VerifiedAt  time.Time `json:"verified_at"`
	ExpiresAt   time.Time `json:"expires_at"`
}

func (h *MFAHandler) Status(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	var enabled bool
	if err := h.db.GetContext(c.Request.Context(), &enabled, `
		SELECT COALESCE(mfa_enabled, false) FROM users WHERE id = $1 AND is_active = true
	`, userID); err != nil {
		if err == sql.ErrNoRows {
			Error(c, http.StatusNotFound, "user_not_found", "User not found")
			return
		}
		Error(c, http.StatusInternalServerError, "mfa_status_failed", "Unable to load MFA status")
		return
	}
	c.JSON(http.StatusOK, MFAStatusResponse{Enabled: enabled})
}

func (h *MFAHandler) Enroll(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	var account struct {
		Email string `db:"email"`
	}
	if err := h.db.GetContext(c.Request.Context(), &account, `
		SELECT email FROM users WHERE id = $1 AND is_active = true
	`, userID); err != nil {
		Error(c, http.StatusNotFound, "user_not_found", "User not found")
		return
	}

	secret, err := mfa.GenerateSecret()
	if err != nil {
		Error(c, http.StatusInternalServerError, "mfa_enroll_failed", "Unable to create MFA enrollment")
		return
	}
	encrypted, err := mfa.EncryptSecret(secret, h.keyMaterial())
	if err != nil {
		Error(c, http.StatusInternalServerError, "mfa_enroll_failed", "Unable to create MFA enrollment")
		return
	}
	if _, err := h.db.ExecContext(c.Request.Context(), `
		UPDATE users
		SET mfa_secret_encrypted = $1, mfa_enabled = false, mfa_confirmed_at = NULL,
		    updated_at = CURRENT_TIMESTAMP
		WHERE id = $2 AND is_active = true
	`, encrypted, userID); err != nil {
		Error(c, http.StatusInternalServerError, "mfa_enroll_failed", "Unable to save MFA enrollment")
		return
	}
	_, _ = h.db.ExecContext(c.Request.Context(), `DELETE FROM user_mfa_recovery_codes WHERE user_id = $1`, userID)

	issuer := url.QueryEscape("Park Opticon")
	label := url.QueryEscape("Park Opticon:" + account.Email)
	otpauthURI := "otpauth://totp/" + label + "?secret=" + secret + "&issuer=" + issuer
	c.JSON(http.StatusOK, MFAEnrollResponse{
		Secret: secret, OTPAuthURI: otpauthURI, RequiresConfirm: true,
	})
}

func (h *MFAHandler) Confirm(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	var req MFACodeRequest
	if err := c.ShouldBindJSON(&req); err != nil || !mfa.ValidateCodeFormat(strings.TrimSpace(req.Code)) {
		Error(c, http.StatusBadRequest, "invalid_mfa_code", "A six-digit MFA code is required")
		return
	}
	secret, err := h.loadSecret(c, userID)
	if err != nil {
		Error(c, http.StatusPreconditionRequired, "mfa_enrollment_required", "Start MFA enrollment before confirming it")
		return
	}
	if !mfa.VerifyCode(secret, req.Code, time.Now().UTC()) {
		Error(c, http.StatusUnauthorized, "invalid_mfa_code", "Invalid MFA code")
		return
	}
	if _, err := h.db.ExecContext(c.Request.Context(), `
		UPDATE users
		SET mfa_enabled = true, mfa_confirmed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
		WHERE id = $1 AND is_active = true
	`, userID); err != nil {
		Error(c, http.StatusInternalServerError, "mfa_confirm_failed", "Unable to confirm MFA")
		return
	}

	_, _ = h.db.ExecContext(c.Request.Context(), `DELETE FROM user_mfa_recovery_codes WHERE user_id = $1`, userID)
	recoveryCodes := make([]string, 0, 8)
	for i := 0; i < 8; i++ {
		code, generateErr := mfa.GenerateRecoveryCode()
		if generateErr != nil {
			Error(c, http.StatusInternalServerError, "mfa_confirm_failed", "Unable to create recovery codes")
			return
		}
		if _, insertErr := h.db.ExecContext(c.Request.Context(), `
			INSERT INTO user_mfa_recovery_codes (user_id, code_hash) VALUES ($1, $2)
		`, userID, mfa.Hash(code)); insertErr != nil {
			Error(c, http.StatusInternalServerError, "mfa_confirm_failed", "Unable to create recovery codes")
			return
		}
		recoveryCodes = append(recoveryCodes, code)
	}
	c.JSON(http.StatusOK, MFAConfirmResponse{Enabled: true, RecoveryCodes: recoveryCodes})
}

func (h *MFAHandler) Verify(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	var req MFACodeRequest
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.Code) == "" {
		Error(c, http.StatusBadRequest, "invalid_mfa_code", "An MFA code is required")
		return
	}
	var account struct {
		Email      string `db:"email"`
		Username   string `db:"username"`
		IsAdmin    bool   `db:"is_admin"`
		MFAEnabled bool   `db:"mfa_enabled"`
	}
	if err := h.db.GetContext(c.Request.Context(), &account, `
		SELECT email, username, is_admin, COALESCE(mfa_enabled, false) AS mfa_enabled
		FROM users WHERE id = $1 AND is_active = true
	`, userID); err != nil {
		Error(c, http.StatusUnauthorized, "invalid_account", "Unable to verify MFA")
		return
	}
	if !account.MFAEnabled {
		Error(c, http.StatusPreconditionRequired, "mfa_enrollment_required", "MFA enrollment is required")
		return
	}
	valid, err := h.verifyCodeOrRecovery(c, userID, req.Code)
	if err != nil || !valid {
		Error(c, http.StatusUnauthorized, "invalid_mfa_code", "Invalid MFA code")
		return
	}
	verifiedAt := time.Now().UTC()
	expiresAt := verifiedAt.Add(h.cfg.JWT.AdminMFAStepUp)
	var accessToken string
	if account.IsAdmin {
		accessToken, err = auth.GenerateAdminVerifiedAccessToken(userID, account.Email, account.Username, true, h.cfg.JWT.Secret, h.cfg.JWT.AccessExpiry, verifiedAt)
	} else {
		accessToken, err = auth.GenerateAccessToken(userID, account.Email, account.Username, false, h.cfg.JWT.Secret, h.cfg.JWT.AccessExpiry)
	}
	if err != nil {
		Error(c, http.StatusInternalServerError, "mfa_token_failed", "Unable to issue verified session")
		return
	}
	c.JSON(http.StatusOK, MFAVerifyResponse{AccessToken: accessToken, VerifiedAt: verifiedAt, ExpiresAt: expiresAt})
}

func (h *MFAHandler) Disable(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	var req MFACodeRequest
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.Code) == "" {
		Error(c, http.StatusBadRequest, "invalid_mfa_code", "An MFA code is required")
		return
	}
	valid, err := h.verifyCodeOrRecovery(c, userID, req.Code)
	if err != nil || !valid {
		Error(c, http.StatusUnauthorized, "invalid_mfa_code", "Invalid MFA code")
		return
	}
	if _, err := h.db.ExecContext(c.Request.Context(), `
		UPDATE users
		SET mfa_enabled = false, mfa_secret_encrypted = NULL, mfa_confirmed_at = NULL,
		    updated_at = CURRENT_TIMESTAMP
		WHERE id = $1
	`, userID); err != nil {
		Error(c, http.StatusInternalServerError, "mfa_disable_failed", "Unable to disable MFA")
		return
	}
	_, _ = h.db.ExecContext(c.Request.Context(), `DELETE FROM user_mfa_recovery_codes WHERE user_id = $1`, userID)
	c.Status(http.StatusNoContent)
}

func (h *MFAHandler) loadSecret(c *gin.Context, userID uuid.UUID) (string, error) {
	var encrypted []byte
	if err := h.db.GetContext(c.Request.Context(), &encrypted, `
		SELECT mfa_secret_encrypted FROM users WHERE id = $1 AND mfa_secret_encrypted IS NOT NULL
	`, userID); err != nil {
		return "", err
	}
	return mfa.DecryptSecret(encrypted, h.keyMaterial())
}

func (h *MFAHandler) verifyCodeOrRecovery(c *gin.Context, userID uuid.UUID, value string) (bool, error) {
	secret, secretErr := h.loadSecret(c, userID)
	if secretErr == nil && mfa.VerifyCode(secret, value, time.Now().UTC()) {
		return true, nil
	}
	result, err := h.db.ExecContext(c.Request.Context(), `
		UPDATE user_mfa_recovery_codes
		SET used_at = CURRENT_TIMESTAMP
		WHERE user_id = $1 AND code_hash = $2 AND used_at IS NULL
	`, userID, mfa.Hash(strings.ToUpper(strings.TrimSpace(value))))
	if err != nil {
		return false, err
	}
	rows, _ := result.RowsAffected()
	return rows == 1, nil
}

func (h *MFAHandler) keyMaterial() string {
	if h.cfg.JWT.MFAEncryptionKey != "" {
		return h.cfg.JWT.MFAEncryptionKey
	}
	return h.cfg.JWT.Secret
}
