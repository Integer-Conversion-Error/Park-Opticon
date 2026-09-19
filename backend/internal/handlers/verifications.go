package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type VerificationHandler struct {
	db *sqlx.DB
}

func NewVerificationHandler(db *sqlx.DB) *VerificationHandler {
	return &VerificationHandler{db: db}
}

type CreateVerificationRequest struct {
	VerificationType string   `json:"verification_type" binding:"required,oneof=confirm deny"`
	Latitude         *float64 `json:"latitude"`
	Longitude        *float64 `json:"longitude"`
	Notes            *string  `json:"notes,omitempty"`
}

type VerificationResponse struct {
	ReportType       string    `json:"report_type"`
	ReportID         uuid.UUID `json:"report_id"`
	VerificationType string    `json:"verification_type"`
	ConfirmedCount   int       `json:"confirmed_count"`
	DeniedCount      int       `json:"denied_count"`
	UpdatedAt        time.Time `json:"updated_at"`
}

func (h *VerificationHandler) VerifyEnforcementAlert(c *gin.Context) {
	h.verify(c, "enforcement_alert", "enforcement_alerts", "active")
}

func (h *VerificationHandler) VerifyParkingSpot(c *gin.Context) {
	h.verify(c, "parking_spot", "parking_spots", "available")
}

func (h *VerificationHandler) verify(c *gin.Context, reportType, table, activeStatus string) {
	userID := c.MustGet("user_id").(uuid.UUID)
	reportID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid report id"})
		return
	}
	var req CreateVerificationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Latitude == nil || req.Longitude == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "latitude and longitude are required to verify a nearby report"})
		return
	}
	if err := validateCoordinates(*req.Latitude, *req.Longitude); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tx, err := h.db.BeginTxx(c.Request.Context(), nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to start verification"})
		return
	}
	defer tx.Rollback()

	var exists bool
	existsQuery := `SELECT EXISTS(
		SELECT 1 FROM ` + table + `
		WHERE id = $1
		  AND status = $2
		  AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
		  AND (reporter_id IS NULL OR reporter_id <> $5)
		  AND ST_DWithin(
				location,
				ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography,
				300
		  )
	)`
	if err := tx.GetContext(c.Request.Context(), &exists, existsQuery, reportID, activeStatus, *req.Longitude, *req.Latitude, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to find report"})
		return
	}
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "report is no longer active"})
		return
	}

	_, err = tx.ExecContext(c.Request.Context(), `
		INSERT INTO verifications (user_id, verifiable_type, verifiable_id, verification_type, notes)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (user_id, verifiable_type, verifiable_id)
		DO UPDATE SET verification_type = EXCLUDED.verification_type,
		              notes = EXCLUDED.notes,
		              created_at = CURRENT_TIMESTAMP
	`, userID, reportType, reportID, req.VerificationType, req.Notes)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save verification"})
		return
	}

	confirmedCount, deniedCount, err := h.refreshCounts(c, tx, reportType, reportID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update report confidence"})
		return
	}
	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to commit verification"})
		return
	}

	c.JSON(http.StatusOK, VerificationResponse{
		ReportType:       reportType,
		ReportID:         reportID,
		VerificationType: req.VerificationType,
		ConfirmedCount:   confirmedCount,
		DeniedCount:      deniedCount,
		UpdatedAt:        time.Now().UTC(),
	})
}

func (h *VerificationHandler) refreshCounts(c *gin.Context, tx *sqlx.Tx, reportType string, reportID uuid.UUID) (int, int, error) {
	var confirmedCount, deniedCount int
	if err := tx.GetContext(c.Request.Context(), &confirmedCount, `
		SELECT COUNT(*) FROM verifications
		WHERE verifiable_type = $1 AND verifiable_id = $2 AND verification_type = 'confirm'
	`, reportType, reportID); err != nil {
		return 0, 0, err
	}
	if err := tx.GetContext(c.Request.Context(), &deniedCount, `
		SELECT COUNT(*) FROM verifications
		WHERE verifiable_type = $1 AND verifiable_id = $2 AND verification_type = 'deny'
	`, reportType, reportID); err != nil {
		return 0, 0, err
	}

	table := "enforcement_alerts"
	if reportType == "parking_spot" {
		table = "parking_spots"
	}
	if _, err := tx.ExecContext(c.Request.Context(), `
		UPDATE `+table+`
		SET verified_by_count = $1, flagged_count = $2
		WHERE id = $3
	`, confirmedCount, deniedCount, reportID); err != nil {
		return 0, 0, err
	}
	return confirmedCount, deniedCount, nil
}
