package handlers

import (
	"database/sql"
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/models"
)

type TemplateHandler struct {
	db *sqlx.DB
}

func NewTemplateHandler(db *sqlx.DB) *TemplateHandler {
	return &TemplateHandler{db: db}
}

// GetAllTemplates returns all parking spot templates
func (h *TemplateHandler) GetAllTemplates(c *gin.Context) {
	log.Println("[Templates] GetAllTemplates: Starting request")

	var templates []models.ParkingSpotTemplate

	query := `
		SELECT id, name, description, spot_type, duration_estimate, notes, 
		       created_at, updated_at
		FROM parking_spot_templates
		ORDER BY name ASC
	`

	err := h.db.Select(&templates, query)
	if err != nil {
		log.Printf("[Templates] GetAllTemplates: Database error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch templates"})
		return
	}

	// Load schedules for each template
	for i := range templates {
		schedules, err := h.getSchedulesForTemplate(templates[i].ID)
		if err != nil {
			log.Printf("[Templates] GetAllTemplates: Failed to load schedules for template %d: %v", templates[i].ID, err)
			continue
		}
		templates[i].Schedules = schedules
	}

	log.Printf("[Templates] GetAllTemplates: Successfully fetched %d templates", len(templates))
	c.JSON(http.StatusOK, templates)
}

// GetTemplateByID returns a single template by ID
func (h *TemplateHandler) GetTemplateByID(c *gin.Context) {
	templateIDStr := c.Param("id")
	templateID, err := strconv.Atoi(templateIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid template ID"})
		return
	}

	var template models.ParkingSpotTemplate
	query := `
		SELECT id, name, description, spot_type, duration_estimate, notes,
		       created_at, updated_at
		FROM parking_spot_templates
		WHERE id = $1
	`

	err = h.db.Get(&template, query, templateID)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Template not found"})
		return
	}
	if err != nil {
		log.Printf("[Templates] GetTemplateByID: Database error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch template"})
		return
	}

	// Load schedules
	schedules, err := h.getSchedulesForTemplate(template.ID)
	if err != nil {
		log.Printf("[Templates] GetTemplateByID: Failed to load schedules: %v", err)
	} else {
		template.Schedules = schedules
	}

	c.JSON(http.StatusOK, template)
}

// CreateTemplate creates a new parking spot template
func (h *TemplateHandler) CreateTemplate(c *gin.Context) {
	var input struct {
		Name             string                       `json:"name" binding:"required"`
		Description      *string                      `json:"description"`
		SpotType         *string                      `json:"spot_type"`
		DurationEstimate *int                         `json:"duration_estimate"`
		Notes            *string                      `json:"notes"`
		Schedules        []models.EnforcementSchedule `json:"schedules"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	log.Printf("[Templates] CreateTemplate: Creating template '%s'", input.Name)

	// Start transaction
	tx, err := h.db.Beginx()
	if err != nil {
		log.Printf("[Templates] CreateTemplate: Failed to start transaction: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create template"})
		return
	}
	defer tx.Rollback()

	// Insert template
	var templateID int
	query := `
		INSERT INTO parking_spot_templates (name, description, spot_type, duration_estimate, notes)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id
	`
	err = tx.QueryRow(query, input.Name, input.Description, input.SpotType, input.DurationEstimate, input.Notes).Scan(&templateID)
	if err != nil {
		log.Printf("[Templates] CreateTemplate: Failed to insert template: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create template"})
		return
	}

	// Insert schedules if provided
	if len(input.Schedules) > 0 {
		for i, schedule := range input.Schedules {
			log.Printf("[Templates] CreateTemplate: Inserting schedule %d: day=%d, start=%s, end=%s, type='%s', desc='%s'",
				i, schedule.DayOfWeek, schedule.StartTime, schedule.EndTime, schedule.ScheduleType,
				func() string {
					if schedule.Description != nil {
						return *schedule.Description
					} else {
						return "nil"
					}
				}())

			scheduleQuery := `
				INSERT INTO enforcement_schedules (template_id, day_of_week, start_time, end_time, schedule_type, description)
				VALUES ($1, $2, $3, $4, $5, $6)
			`
			_, err = tx.Exec(scheduleQuery, templateID, schedule.DayOfWeek, schedule.StartTime, schedule.EndTime, schedule.ScheduleType, schedule.Description)
			if err != nil {
				log.Printf("[Templates] CreateTemplate: Failed to insert schedule: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create template schedules"})
				return
			}
		}
	}

	// Commit transaction
	if err = tx.Commit(); err != nil {
		log.Printf("[Templates] CreateTemplate: Failed to commit transaction: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create template"})
		return
	}

	// Fetch the created template with schedules
	var template models.ParkingSpotTemplate
	query = `
		SELECT id, name, description, spot_type, duration_estimate, notes,
		       created_at, updated_at
		FROM parking_spot_templates
		WHERE id = $1
	`
	err = h.db.Get(&template, query, templateID)
	if err != nil {
		log.Printf("[Templates] CreateTemplate: Failed to fetch created template: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Template created but failed to fetch"})
		return
	}

	template.Schedules, _ = h.getSchedulesForTemplate(templateID)

	log.Printf("[Templates] CreateTemplate: Successfully created template with ID %d", templateID)
	c.JSON(http.StatusCreated, template)
}

// UpdateTemplate updates an existing template
func (h *TemplateHandler) UpdateTemplate(c *gin.Context) {
	templateIDStr := c.Param("id")
	templateID, err := strconv.Atoi(templateIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid template ID"})
		return
	}

	var input struct {
		Name             string                       `json:"name"`
		Description      *string                      `json:"description"`
		SpotType         *string                      `json:"spot_type"`
		DurationEstimate *int                         `json:"duration_estimate"`
		Notes            *string                      `json:"notes"`
		Schedules        []models.EnforcementSchedule `json:"schedules"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	log.Printf("[Templates] UpdateTemplate: Updating template %d", templateID)

	// Start transaction
	tx, err := h.db.Beginx()
	if err != nil {
		log.Printf("[Templates] UpdateTemplate: Failed to start transaction: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update template"})
		return
	}
	defer tx.Rollback()

	// Update template
	query := `
		UPDATE parking_spot_templates
		SET name = $1, description = $2, spot_type = $3, 
		    duration_estimate = $4, notes = $5, updated_at = CURRENT_TIMESTAMP
		WHERE id = $6
	`
	result, err := tx.Exec(query, input.Name, input.Description, input.SpotType, input.DurationEstimate, input.Notes, templateID)
	if err != nil {
		log.Printf("[Templates] UpdateTemplate: Failed to update template: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update template"})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Template not found"})
		return
	}

	// Delete existing schedules and insert new ones
	_, err = tx.Exec("DELETE FROM enforcement_schedules WHERE template_id = $1", templateID)
	if err != nil {
		log.Printf("[Templates] UpdateTemplate: Failed to delete old schedules: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update schedules"})
		return
	}

	// Insert new schedules
	if len(input.Schedules) > 0 {
		for _, schedule := range input.Schedules {
			scheduleQuery := `
				INSERT INTO enforcement_schedules (template_id, day_of_week, start_time, end_time, schedule_type, description)
				VALUES ($1, $2, $3, $4, $5, $6)
			`
			_, err = tx.Exec(scheduleQuery, templateID, schedule.DayOfWeek, schedule.StartTime, schedule.EndTime, schedule.ScheduleType, schedule.Description)
			if err != nil {
				log.Printf("[Templates] UpdateTemplate: Failed to insert schedule: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update schedules"})
				return
			}
		}
	}

	// Commit transaction
	if err = tx.Commit(); err != nil {
		log.Printf("[Templates] UpdateTemplate: Failed to commit transaction: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update template"})
		return
	}

	// Fetch updated template
	var template models.ParkingSpotTemplate
	query = `
		SELECT id, name, description, spot_type, duration_estimate, notes,
		       created_at, updated_at
		FROM parking_spot_templates
		WHERE id = $1
	`
	err = h.db.Get(&template, query, templateID)
	if err != nil {
		log.Printf("[Templates] UpdateTemplate: Failed to fetch updated template: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Template updated but failed to fetch"})
		return
	}

	template.Schedules, _ = h.getSchedulesForTemplate(templateID)

	log.Printf("[Templates] UpdateTemplate: Successfully updated template %d", templateID)
	c.JSON(http.StatusOK, template)
}

// DeleteTemplate deletes a template
func (h *TemplateHandler) DeleteTemplate(c *gin.Context) {
	templateIDStr := c.Param("id")
	templateID, err := strconv.Atoi(templateIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid template ID"})
		return
	}

	log.Printf("[Templates] DeleteTemplate: Deleting template %d", templateID)

	query := `DELETE FROM parking_spot_templates WHERE id = $1`
	result, err := h.db.Exec(query, templateID)
	if err != nil {
		log.Printf("[Templates] DeleteTemplate: Database error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete template"})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Template not found"})
		return
	}

	log.Printf("[Templates] DeleteTemplate: Successfully deleted template %d", templateID)
	c.JSON(http.StatusOK, gin.H{"message": "Template deleted successfully"})
}

// Helper function to get schedules for a template
func (h *TemplateHandler) getSchedulesForTemplate(templateID int) ([]models.EnforcementSchedule, error) {
	var schedules []models.EnforcementSchedule
	query := `
		SELECT id, template_id, day_of_week, start_time, end_time, schedule_type, description, created_at
		FROM enforcement_schedules
		WHERE template_id = $1
		ORDER BY day_of_week, start_time
	`
	err := h.db.Select(&schedules, query, templateID)
	if err != nil {
		return nil, err
	}
	return schedules, nil
}
