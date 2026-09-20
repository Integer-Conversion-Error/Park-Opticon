package handlers

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type PreferencesHandler struct {
	db *sqlx.DB
}

func NewPreferencesHandler(db *sqlx.DB) *PreferencesHandler {
	return &PreferencesHandler{db: db}
}

type PreferencesResponse struct {
	NotificationsEnabled           bool `json:"notifications_enabled" db:"notifications_enabled"`
	EnforcementAlertsEnabled       bool `json:"enforcement_alerts_enabled" db:"enforcement_alerts_enabled"`
	NotificationRadiusMeters       int  `json:"notification_radius_meters" db:"notification_radius_meters"`
	AskAboutEnforcementAfterPark   bool `json:"ask_about_enforcement_after_parking" db:"ask_about_enforcement_after_parking"`
	AnnounceOpenSpotAfterUnparking bool `json:"announce_open_spot_after_unparking" db:"announce_open_spot_after_unparking"`
}

type UpdatePreferencesRequest struct {
	NotificationsEnabled            *bool `json:"notifications_enabled"`
	EnforcementAlertsEnabled        *bool `json:"enforcement_alerts_enabled"`
	NotificationRadiusMeters        *int  `json:"notification_radius_meters"`
	AskAboutEnforcementAfterParking *bool `json:"ask_about_enforcement_after_parking"`
	AnnounceOpenSpotAfterUnparking  *bool `json:"announce_open_spot_after_unparking"`
}

const preferencesColumns = `
	notifications_enabled,
	enforcement_alerts_enabled,
	notification_radius_meters,
	ask_about_enforcement_after_parking,
	announce_open_spot_after_unparking`

func (h *PreferencesHandler) Get(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	preferences, err := h.get(c, userID)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load preferences"})
		return
	}
	c.JSON(http.StatusOK, preferences)
}

func (h *PreferencesHandler) Update(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	var req UpdatePreferencesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.NotificationRadiusMeters != nil && (*req.NotificationRadiusMeters < 100 || *req.NotificationRadiusMeters > 1500) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "notification_radius_meters must be between 100 and 1500"})
		return
	}
	if req.NotificationsEnabled == nil && req.EnforcementAlertsEnabled == nil &&
		req.NotificationRadiusMeters == nil && req.AskAboutEnforcementAfterParking == nil &&
		req.AnnounceOpenSpotAfterUnparking == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "at least one preference is required"})
		return
	}

	_, err := h.db.ExecContext(c.Request.Context(), `
		UPDATE users
		SET notifications_enabled = COALESCE($1, notifications_enabled),
			enforcement_alerts_enabled = COALESCE($2, enforcement_alerts_enabled),
			notification_radius_meters = COALESCE($3, notification_radius_meters),
			ask_about_enforcement_after_parking = COALESCE($4, ask_about_enforcement_after_parking),
			announce_open_spot_after_unparking = COALESCE($5, announce_open_spot_after_unparking),
			updated_at = CURRENT_TIMESTAMP
		WHERE id = $6
	`, req.NotificationsEnabled, req.EnforcementAlertsEnabled, req.NotificationRadiusMeters,
		req.AskAboutEnforcementAfterParking, req.AnnounceOpenSpotAfterUnparking, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update preferences"})
		return
	}

	preferences, err := h.get(c, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Preferences updated but could not be reloaded"})
		return
	}
	c.JSON(http.StatusOK, preferences)
}

func (h *PreferencesHandler) get(c *gin.Context, userID uuid.UUID) (*PreferencesResponse, error) {
	var preferences PreferencesResponse
	err := h.db.GetContext(c.Request.Context(), &preferences, `
		SELECT `+preferencesColumns+`
		FROM users
		WHERE id = $1 AND is_active = true
	`, userID)
	return &preferences, err
}
