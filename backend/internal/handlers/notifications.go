package handlers

import (
	"database/sql"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/models"
)

type NotificationsHandler struct {
	db *sqlx.DB
}

func NewNotificationsHandler(db *sqlx.DB) *NotificationsHandler {
	return &NotificationsHandler{db: db}
}

type NotificationsResponse struct {
	Notifications []models.Notification `json:"notifications"`
	UnreadCount   int                   `json:"unread_count"`
}

const notificationColumns = `
	id, user_id, title, body, notification_type, related_type, related_id,
	status, sent_at, read_at, error_message, created_at`

func (h *NotificationsHandler) List(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	limit := 50
	if raw := c.Query("limit"); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed < 1 || parsed > 100 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "limit must be between 1 and 100"})
			return
		}
		limit = parsed
	}

	unreadOnly := false
	if raw := c.Query("unread_only"); raw != "" {
		parsed, err := strconv.ParseBool(raw)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "unread_only must be true or false"})
			return
		}
		unreadOnly = parsed
	}

	query := `
		SELECT ` + notificationColumns + `
		FROM notifications
		WHERE user_id = $1`
	if unreadOnly {
		query += ` AND read_at IS NULL`
	}
	query += ` ORDER BY created_at DESC LIMIT $2`

	var notifications []models.Notification
	if err := h.db.SelectContext(c.Request.Context(), &notifications, query, userID, limit); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load notifications"})
		return
	}
	if notifications == nil {
		notifications = []models.Notification{}
	}

	var unreadCount int
	if err := h.db.GetContext(c.Request.Context(), &unreadCount, `
		SELECT COUNT(*)
		FROM notifications
		WHERE user_id = $1 AND read_at IS NULL
	`, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to count unread notifications"})
		return
	}

	c.JSON(http.StatusOK, NotificationsResponse{
		Notifications: notifications,
		UnreadCount:   unreadCount,
	})
}

func (h *NotificationsHandler) MarkRead(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	notificationID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid notification ID"})
		return
	}

	var notification models.Notification
	err = h.db.GetContext(c.Request.Context(), &notification, `
		UPDATE notifications
		SET status = 'read', read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
		WHERE id = $1 AND user_id = $2
		RETURNING `+notificationColumns, notificationID, userID)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Notification not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to mark notification as read"})
		return
	}

	c.JSON(http.StatusOK, notification)
}

func (h *NotificationsHandler) MarkAllRead(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	result, err := h.db.ExecContext(c.Request.Context(), `
		UPDATE notifications
		SET status = 'read', read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
		WHERE user_id = $1 AND read_at IS NULL
	`, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to mark notifications as read"})
		return
	}
	count, _ := result.RowsAffected()
	c.JSON(http.StatusOK, gin.H{"marked_read": count})
}
