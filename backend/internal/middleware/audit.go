package middleware

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

func AdminAuditLogger(db *sqlx.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()

		if c.Writer.Status() >= http.StatusInternalServerError || db == nil {
			return
		}
		userID, ok := c.Get("user_id")
		if !ok {
			return
		}
		actor, ok := userID.(uuid.UUID)
		if !ok {
			return
		}
		_, _ = db.ExecContext(c.Request.Context(), `
			INSERT INTO audit_logs (user_id, action, entity_type, ip_address, user_agent)
			VALUES ($1, $2, $3, $4, $5)
		`, actor, c.Request.Method+" "+c.FullPath(), "admin_api", c.ClientIP(), c.Request.UserAgent())
	}
}

func IsNotFound(err error) bool {
	return err == sql.ErrNoRows
}
