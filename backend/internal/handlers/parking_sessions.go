package handlers

import (
	"database/sql"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/database"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/models"
)

// ParkingSessionHandler owns the small lifecycle used by the mobile app:
// start a session at the user's current location, read it, and end it.
type ParkingSessionHandler struct {
	db *sqlx.DB
}

func NewParkingSessionHandler(db *sqlx.DB) *ParkingSessionHandler {
	return &ParkingSessionHandler{db: db}
}

type CreateParkingSessionRequest struct {
	Latitude  float64    `json:"latitude" binding:"required"`
	Longitude float64    `json:"longitude" binding:"required"`
	Address   *string    `json:"address"`
	VehicleID *uuid.UUID `json:"vehicle_id"`
}

type EndParkingSessionRequest struct {
	ShareOpenSpot *bool `json:"share_open_spot"`
}

type SubmitParkingFeedbackRequest struct {
	SawEnforcement *bool   `json:"saw_enforcement"`
	Latitude       float64 `json:"latitude"`
	Longitude      float64 `json:"longitude"`
	Notes          *string `json:"notes,omitempty"`
}

const parkingSessionColumns = `
	id, user_id, vehicle_id, latitude, longitude, address, started_at,
	ended_at, duration_minutes, is_active, alerts_received_count,
	created_at, updated_at`

// Create starts a parking session for the authenticated user.
func (h *ParkingSessionHandler) Create(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	var req CreateParkingSessionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := validateCoordinates(req.Latitude, req.Longitude); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.VehicleID != nil {
		var ownsVehicle bool
		if err := h.db.GetContext(c.Request.Context(), &ownsVehicle, `
			SELECT EXISTS(
				SELECT 1 FROM vehicles WHERE id = $1 AND user_id = $2 AND is_active = true
			)
		`, req.VehicleID, userID); err != nil {
			Error(c, http.StatusInternalServerError, "vehicle_check_failed", "Unable to validate vehicle")
			return
		}
		if !ownsVehicle {
			Error(c, http.StatusForbidden, "vehicle_forbidden", "Vehicle does not belong to this account")
			return
		}
	}

	tx, err := h.db.BeginTxx(c.Request.Context(), nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start parking session transaction"})
		return
	}
	defer tx.Rollback()

	session := &models.ParkingSession{}
	err = tx.QueryRowxContext(c.Request.Context(), `
		INSERT INTO parking_sessions (
			user_id, vehicle_id, location, latitude, longitude, address
		)
		VALUES (
			$1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326), $4, $3, $5
		)
		RETURNING `+parkingSessionColumns+`
	`, userID, req.VehicleID, req.Longitude, req.Latitude, req.Address).StructScan(session)
	if err != nil {
		if database.IsUniqueViolation(err) {
			c.JSON(http.StatusConflict, gin.H{"error": "You already have an active parking session"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start parking session"})
		return
	}
	if _, err = tx.ExecContext(c.Request.Context(), `
		INSERT INTO alert_dispatch_jobs (event_type, parking_session_id)
		VALUES ('parking_session_started', $1)
		ON CONFLICT (event_type, parking_session_id) DO NOTHING
	`, session.ID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to queue parking-session alert check"})
		return
	}
	if err = tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save parking session"})
		return
	}

	c.JSON(http.StatusCreated, session)
}

// Active returns the authenticated user's current parking session, if any.
func (h *ParkingSessionHandler) Active(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	session := &models.ParkingSession{}

	err := h.db.GetContext(c.Request.Context(), session, `
		SELECT `+parkingSessionColumns+`
		FROM parking_sessions
		WHERE user_id = $1 AND is_active = true
		ORDER BY started_at DESC
		LIMIT 1
	`, userID)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusOK, gin.H{"active": false, "session": nil})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch active parking session"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"active": true, "session": session})
}

// End closes an active parking session owned by the authenticated user.
func (h *ParkingSessionHandler) End(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	sessionID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid parking session ID"})
		return
	}

	var req EndParkingSessionRequest
	if c.Request.ContentLength > 0 {
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
	}

	tx, err := h.db.BeginTxx(c.Request.Context(), nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start parking session transaction"})
		return
	}
	defer tx.Rollback()

	now := time.Now().UTC()
	session := &models.ParkingSession{}
	err = tx.QueryRowxContext(c.Request.Context(), `
		UPDATE parking_sessions
		SET ended_at = $1,
			duration_minutes = GREATEST(0, FLOOR(EXTRACT(EPOCH FROM ($1 - started_at)) / 60))::INTEGER,
			is_active = false,
			updated_at = $1
		WHERE id = $2 AND user_id = $3 AND is_active = true
		RETURNING `+parkingSessionColumns+`
	`, now, sessionID, userID).StructScan(session)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Active parking session not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to end parking session"})
		return
	}

	shareOpenSpot := false
	if req.ShareOpenSpot != nil {
		shareOpenSpot = *req.ShareOpenSpot
	} else if err := tx.GetContext(c.Request.Context(), &shareOpenSpot, `
		SELECT COALESCE(announce_open_spot_after_unparking, true)
		FROM users
		WHERE id = $1
	`, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load open-spot preference"})
		return
	}

	var openSpot *models.ParkingSpot
	if shareOpenSpot {
		createdAt := now
		staleAt := now.Add(5 * time.Minute)
		expiresAt := now.Add(15 * time.Minute)
		spot := &models.ParkingSpot{}
		err = tx.QueryRowxContext(c.Request.Context(), `
			INSERT INTO parking_spots (
				reporter_id, location, latitude, longitude, address,
				spot_type, duration_estimate, notes, report_source,
				expires_at, stale_at, created_at
			)
			VALUES (
				$1, ST_SetSRID(ST_MakePoint($2, $3), 4326), $3, $2, $4,
				'open_spot', 15, 'Recently vacated parking spot', 'user_unpark',
				$5, $6, $7
			)
			RETURNING id, NULL::uuid AS reporter_id, latitude, longitude,
			          address, spot_type, duration_estimate, notes, status,
			          report_source, verified_by_count, flagged_count,
			          created_at, expires_at, stale_at, taken_at
		`, userID, session.Longitude, session.Latitude, session.Address,
			expiresAt, staleAt, createdAt).StructScan(spot)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Parking session ended but open spot could not be shared"})
			return
		}
		openSpot = spot
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit parking session"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"session":          session,
		"open_spot":        openSpot,
		"shared_open_spot": shareOpenSpot,
	})
}

// SubmitFeedback records the short post-parking observation and confirms any
// active enforcement reports within the same 300 metre window and time frame.
func (h *ParkingSessionHandler) SubmitFeedback(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	sessionID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid parking session ID"})
		return
	}

	var req SubmitParkingFeedbackRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.SawEnforcement == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "saw_enforcement is required"})
		return
	}
	if err := validateCoordinates(req.Latitude, req.Longitude); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tx, err := h.db.BeginTxx(c.Request.Context(), nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start feedback transaction"})
		return
	}
	defer tx.Rollback()

	var sessionStartedAt time.Time
	err = tx.GetContext(c.Request.Context(), &sessionStartedAt, `
		SELECT started_at
		FROM parking_sessions
		WHERE id = $1 AND user_id = $2
	`, sessionID, userID)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Parking session not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load parking session"})
		return
	}

	feedback := &models.ParkingSessionFeedback{}
	err = tx.QueryRowxContext(c.Request.Context(), `
		INSERT INTO parking_session_feedback (
			session_id, user_id, saw_enforcement, latitude, longitude, notes
		)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (session_id) DO UPDATE SET
			user_id = EXCLUDED.user_id,
			saw_enforcement = EXCLUDED.saw_enforcement,
			latitude = EXCLUDED.latitude,
			longitude = EXCLUDED.longitude,
			notes = EXCLUDED.notes,
			created_at = CURRENT_TIMESTAMP
		RETURNING id, session_id, user_id, saw_enforcement, latitude,
		          longitude, notes, created_at
	`, sessionID, userID, *req.SawEnforcement, req.Latitude, req.Longitude, req.Notes).StructScan(feedback)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save parking feedback"})
		return
	}

	verifiedAlertIDs := []uuid.UUID{}
	if *req.SawEnforcement {
		if err := tx.SelectContext(c.Request.Context(), &verifiedAlertIDs, `
			SELECT id
			FROM enforcement_alerts
			WHERE status = 'active'
			  AND expires_at > CURRENT_TIMESTAMP
			  AND created_at >= $3
			  AND (reporter_id IS NULL OR reporter_id <> $4)
			  AND ST_DWithin(
					location,
					ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
					300
				  )
		`, req.Longitude, req.Latitude, sessionStartedAt, userID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to find nearby enforcement reports"})
			return
		}
		for _, alertID := range verifiedAlertIDs {
			if _, err := tx.ExecContext(c.Request.Context(), `
				INSERT INTO verifications (
					user_id, verifiable_type, verifiable_id, verification_type, notes
				)
				VALUES ($1, 'enforcement_alert', $2, 'confirm', $3)
				ON CONFLICT (user_id, verifiable_type, verifiable_id)
				DO UPDATE SET verification_type = 'confirm', notes = EXCLUDED.notes,
				              created_at = CURRENT_TIMESTAMP
			`, userID, alertID, req.Notes); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify nearby enforcement report"})
				return
			}
			if err := refreshEnforcementCounts(c, tx, alertID); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update enforcement confidence"})
				return
			}
		}
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit feedback"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"feedback":           feedback,
		"verified_alert_ids": verifiedAlertIDs,
	})
}

func refreshEnforcementCounts(c *gin.Context, tx *sqlx.Tx, alertID uuid.UUID) error {
	_, err := tx.ExecContext(c.Request.Context(), `
		UPDATE enforcement_alerts ea
		SET verified_by_count = counts.confirmed_count,
		    flagged_count = counts.denied_count
		FROM (
			SELECT
				COUNT(*) FILTER (WHERE verification_type = 'confirm') AS confirmed_count,
				COUNT(*) FILTER (WHERE verification_type = 'deny') AS denied_count
			FROM verifications
			WHERE verifiable_type = 'enforcement_alert'
			  AND verifiable_id = $1
		) counts
		WHERE ea.id = $1
	`, alertID)
	return err
}
