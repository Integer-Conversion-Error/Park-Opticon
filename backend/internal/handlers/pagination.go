package handlers

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

func parsePagination(c *gin.Context, defaultLimit, maxLimit int) (int, int, bool) {
	limit := defaultLimit
	offset := 0
	if raw := c.Query("limit"); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed < 1 || parsed > maxLimit {
			Error(c, http.StatusBadRequest, "invalid_limit", fmt.Sprintf("limit must be between 1 and %d", maxLimit))
			return 0, 0, false
		}
		limit = parsed
	}
	if raw := c.Query("offset"); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed < 0 {
			Error(c, http.StatusBadRequest, "invalid_offset", "offset must be zero or greater")
			return 0, 0, false
		}
		offset = parsed
	}
	return limit, offset, true
}
