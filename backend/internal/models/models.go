package models

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID    uuid.UUID `json:"id" db:"id"`
	Email string    `json:"email" db:"email"`
	// Password is nil for accounts created with an external sign-in provider.
	// Keeping that state distinct from a password hash prevents an invented
	// credential from becoming an accidental recovery path.
	Password *string `json:"-" db:"password_hash"`
	Username string  `json:"username" db:"username"`
	FullName *string `json:"full_name,omitempty" db:"full_name"`
	Phone    *string `json:"phone_number,omitempty" db:"phone_number"`

	AvatarURL   *string `json:"avatar_url,omitempty" db:"avatar_url"`
	Bio         *string `json:"bio,omitempty" db:"bio"`
	KarmaPoints int     `json:"karma_points" db:"karma_points"`

	PushToken                *string `json:"-" db:"push_notification_token"`
	NotificationsEnabled     bool    `json:"notifications_enabled" db:"notifications_enabled"`
	EnforcementAlertsEnabled bool    `json:"enforcement_alerts_enabled" db:"enforcement_alerts_enabled"`
	ParkingRadiusMiles       float64 `json:"parking_radius_miles" db:"parking_radius_miles"`
	NotificationRadiusMeters int     `json:"notification_radius_meters" db:"notification_radius_meters"`
	AskAfterParking          bool    `json:"ask_about_enforcement_after_parking" db:"ask_about_enforcement_after_parking"`
	AnnounceOpenSpot         bool    `json:"announce_open_spot_after_unparking" db:"announce_open_spot_after_unparking"`
	MFAEnabled               bool    `json:"mfa_enabled" db:"mfa_enabled"`

	EmailVerified bool       `json:"email_verified" db:"email_verified"`
	IsActive      bool       `json:"is_active" db:"is_active"`
	IsAdmin       bool       `json:"is_admin" db:"is_admin"`
	CreatedAt     time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at" db:"updated_at"`
	LastLoginAt   *time.Time `json:"last_login_at,omitempty" db:"last_login_at"`
}

// CommunityImpact contains event-backed contribution counts for one user. The
// fields deliberately describe what happened instead of deriving a subjective
// trust or reputation score.
type CommunityImpact struct {
	ReportsShared             int `json:"reports_shared" db:"reports_shared"`
	OpenSpotsShared           int `json:"open_spots_shared" db:"open_spots_shared"`
	EnforcementAlertsReported int `json:"enforcement_alerts_reported" db:"enforcement_alerts_reported"`
	ReportsConfirmed          int `json:"reports_confirmed" db:"reports_confirmed"`
	ReportsChecked            int `json:"reports_checked" db:"reports_checked"`
	ConfirmationsGiven        int `json:"confirmations_given" db:"confirmations_given"`
	CorrectionsGiven          int `json:"corrections_given" db:"corrections_given"`
	DriversAlerted            int `json:"drivers_alerted" db:"drivers_alerted"`
}

type Vehicle struct {
	ID            uuid.UUID `json:"id" db:"id"`
	UserID        uuid.UUID `json:"user_id" db:"user_id"`
	Nickname      *string   `json:"nickname,omitempty" db:"nickname"`
	Make          *string   `json:"make,omitempty" db:"make"`
	Model         *string   `json:"model,omitempty" db:"model"`
	Year          *int      `json:"year,omitempty" db:"year"`
	Color         *string   `json:"color,omitempty" db:"color"`
	LicensePlate  string    `json:"license_plate" db:"license_plate"`
	StateProvince *string   `json:"state_province,omitempty" db:"state_province"`
	IsDefault     bool      `json:"is_default" db:"is_default"`
	IsActive      bool      `json:"is_active" db:"is_active"`
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time `json:"updated_at" db:"updated_at"`
}

type ParkingSpot struct {
	ID               uuid.UUID  `json:"id" db:"id"`
	ReporterID       *uuid.UUID `json:"reporter_id,omitempty" db:"reporter_id"`
	TemplateID       *int       `json:"template_id,omitempty" db:"template_id"`
	Latitude         float64    `json:"latitude" db:"latitude"`
	Longitude        float64    `json:"longitude" db:"longitude"`
	Address          *string    `json:"address,omitempty" db:"address"`
	StreetName       *string    `json:"street_name,omitempty" db:"street_name"`
	SpotType         *string    `json:"spot_type,omitempty" db:"spot_type"`
	DurationEstimate *int       `json:"duration_estimate,omitempty" db:"duration_estimate"`
	Notes            *string    `json:"notes,omitempty" db:"notes"`
	Status           string     `json:"status" db:"status"`
	ReportSource     string     `json:"report_source" db:"report_source"`
	VerifiedByCount  int        `json:"verified_by_count" db:"verified_by_count"`
	FlaggedCount     int        `json:"flagged_count" db:"flagged_count"`
	// Polygon corners (4 corners defining the parking spot boundary)
	Corner1Lat     *float64              `json:"corner1_lat,omitempty" db:"corner1_lat"`
	Corner1Lon     *float64              `json:"corner1_lon,omitempty" db:"corner1_lon"`
	Corner2Lat     *float64              `json:"corner2_lat,omitempty" db:"corner2_lat"`
	Corner2Lon     *float64              `json:"corner2_lon,omitempty" db:"corner2_lon"`
	Corner3Lat     *float64              `json:"corner3_lat,omitempty" db:"corner3_lat"`
	Corner3Lon     *float64              `json:"corner3_lon,omitempty" db:"corner3_lon"`
	Corner4Lat     *float64              `json:"corner4_lat,omitempty" db:"corner4_lat"`
	Corner4Lon     *float64              `json:"corner4_lon,omitempty" db:"corner4_lon"`
	Geofence       *string               `json:"geofence,omitempty" db:"geofence_json"` // GeoJSON string
	CreatedAt      time.Time             `json:"created_at" db:"created_at"`
	ExpiresAt      *time.Time            `json:"expires_at,omitempty" db:"expires_at"`
	TakenAt        *time.Time            `json:"taken_at,omitempty" db:"taken_at"`
	Photos         []Photo               `json:"photos,omitempty" db:"-"`
	DistanceMiles  *float64              `json:"distance_miles,omitempty" db:"distance_miles"`
	DistanceMeters *float64              `json:"distance_meters,omitempty" db:"distance_meters"`
	StaleAt        *time.Time            `json:"stale_at,omitempty" db:"stale_at"`
	Schedules      []EnforcementSchedule `json:"schedules,omitempty" db:"-"`
}

type ParkingSpotTemplate struct {
	ID               int                   `json:"id" db:"id"`
	Name             string                `json:"name" db:"name"`
	Description      *string               `json:"description,omitempty" db:"description"`
	SpotType         *string               `json:"spot_type,omitempty" db:"spot_type"`
	DurationEstimate *int                  `json:"duration_estimate,omitempty" db:"duration_estimate"`
	Notes            *string               `json:"notes,omitempty" db:"notes"`
	CreatedAt        time.Time             `json:"created_at" db:"created_at"`
	UpdatedAt        time.Time             `json:"updated_at" db:"updated_at"`
	Schedules        []EnforcementSchedule `json:"schedules,omitempty" db:"-"`
}

type EnforcementSchedule struct {
	ID            int        `json:"id" db:"id"`
	ParkingSpotID *uuid.UUID `json:"parking_spot_id,omitempty" db:"parking_spot_id"`
	TemplateID    *int       `json:"template_id,omitempty" db:"template_id"`
	DayOfWeek     int        `json:"day_of_week" db:"day_of_week"`     // 0=Sunday, 1=Monday, ..., 6=Saturday
	StartTime     string     `json:"start_time" db:"start_time"`       // HH:MM:SS format
	EndTime       string     `json:"end_time" db:"end_time"`           // HH:MM:SS format
	ScheduleType  string     `json:"schedule_type" db:"schedule_type"` // 'enforced', 'no_parking', 'no_stopping', 'free'
	Description   *string    `json:"description,omitempty" db:"description"`
	CreatedAt     time.Time  `json:"created_at" db:"created_at"`
}

type EnforcementAlert struct {
	ID              uuid.UUID  `json:"id" db:"id"`
	ReporterID      *uuid.UUID `json:"reporter_id,omitempty" db:"reporter_id"`
	Latitude        float64    `json:"latitude" db:"latitude"`
	Longitude       float64    `json:"longitude" db:"longitude"`
	Address         *string    `json:"address,omitempty" db:"address"`
	StreetName      *string    `json:"street_name,omitempty" db:"street_name"`
	EnforcementType string     `json:"enforcement_type" db:"enforcement_type"`
	Description     string     `json:"description" db:"description"`
	Severity        string     `json:"severity" db:"severity"`
	Status          string     `json:"status" db:"status"`
	VerifiedByCount int        `json:"verified_by_count" db:"verified_by_count"`
	FlaggedCount    int        `json:"flagged_count" db:"flagged_count"`
	CreatedAt       time.Time  `json:"created_at" db:"created_at"`
	ExpiresAt       time.Time  `json:"expires_at" db:"expires_at"`
	ResolvedAt      *time.Time `json:"resolved_at,omitempty" db:"resolved_at"`
	Photos          []Photo    `json:"photos,omitempty" db:"-"`
	DistanceMiles   *float64   `json:"distance_miles,omitempty" db:"distance_miles"`
	DistanceMeters  *float64   `json:"distance_meters,omitempty" db:"distance_meters"`
}

type ParkingSession struct {
	ID                  uuid.UUID  `json:"id" db:"id"`
	UserID              uuid.UUID  `json:"user_id" db:"user_id"`
	VehicleID           *uuid.UUID `json:"vehicle_id,omitempty" db:"vehicle_id"`
	Latitude            float64    `json:"latitude" db:"latitude"`
	Longitude           float64    `json:"longitude" db:"longitude"`
	Address             *string    `json:"address,omitempty" db:"address"`
	StartedAt           time.Time  `json:"started_at" db:"started_at"`
	EndedAt             *time.Time `json:"ended_at,omitempty" db:"ended_at"`
	DurationMinutes     *int       `json:"duration_minutes,omitempty" db:"duration_minutes"`
	IsActive            bool       `json:"is_active" db:"is_active"`
	AlertsReceivedCount int        `json:"alerts_received_count" db:"alerts_received_count"`
	CreatedAt           time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt           time.Time  `json:"updated_at" db:"updated_at"`
	Vehicle             *Vehicle   `json:"vehicle,omitempty" db:"-"`
}

type Ticket struct {
	ID                   uuid.UUID  `json:"id" db:"id"`
	UserID               uuid.UUID  `json:"user_id" db:"user_id"`
	VehicleID            *uuid.UUID `json:"vehicle_id,omitempty" db:"vehicle_id"`
	TicketNumber         *string    `json:"ticket_number,omitempty" db:"ticket_number"`
	CitationNumber       *string    `json:"citation_number,omitempty" db:"citation_number"`
	ViolationType        string     `json:"violation_type" db:"violation_type"`
	ViolationDescription *string    `json:"violation_description,omitempty" db:"violation_description"`
	AmountCents          int        `json:"amount_cents" db:"amount_cents"`
	Currency             string     `json:"currency" db:"currency"`
	Latitude             *float64   `json:"latitude,omitempty" db:"latitude"`
	Longitude            *float64   `json:"longitude,omitempty" db:"longitude"`
	Address              *string    `json:"address,omitempty" db:"address"`
	IssuedDate           time.Time  `json:"issued_date" db:"issued_date"`
	IssuedTime           *time.Time `json:"issued_time,omitempty" db:"issued_time"`
	Status               string     `json:"status" db:"status"`
	DueDate              *time.Time `json:"due_date,omitempty" db:"due_date"`
	PaidDate             *time.Time `json:"paid_date,omitempty" db:"paid_date"`
	PaidAmountCents      *int       `json:"paid_amount_cents,omitempty" db:"paid_amount_cents"`
	AppealedAt           *time.Time `json:"appealed_at,omitempty" db:"appealed_at"`
	AppealStatus         *string    `json:"appeal_status,omitempty" db:"appeal_status"`
	AppealNotes          *string    `json:"appeal_notes,omitempty" db:"appeal_notes"`
	Notes                *string    `json:"notes,omitempty" db:"notes"`
	CreatedAt            time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt            time.Time  `json:"updated_at" db:"updated_at"`
	Photos               []Photo    `json:"photos,omitempty" db:"-"`
}

type Photo struct {
	ID            uuid.UUID `json:"id" db:"id"`
	PhotoURL      string    `json:"photo_url" db:"photo_url"`
	ThumbnailURL  *string   `json:"thumbnail_url,omitempty" db:"thumbnail_url"`
	FileSizeBytes *int      `json:"file_size_bytes,omitempty" db:"file_size_bytes"`
	MimeType      *string   `json:"mime_type,omitempty" db:"mime_type"`
	UploadedAt    time.Time `json:"uploaded_at" db:"uploaded_at"`
}

type Verification struct {
	ID               uuid.UUID `json:"id" db:"id"`
	UserID           uuid.UUID `json:"user_id" db:"user_id"`
	VerifiableType   string    `json:"verifiable_type" db:"verifiable_type"`
	VerifiableID     uuid.UUID `json:"verifiable_id" db:"verifiable_id"`
	VerificationType string    `json:"verification_type" db:"verification_type"`
	Notes            *string   `json:"notes,omitempty" db:"notes"`
	CreatedAt        time.Time `json:"created_at" db:"created_at"`
}

type Notification struct {
	ID               uuid.UUID  `json:"id" db:"id"`
	UserID           uuid.UUID  `json:"user_id" db:"user_id"`
	Title            string     `json:"title" db:"title"`
	Body             string     `json:"body" db:"body"`
	NotificationType string     `json:"notification_type" db:"notification_type"`
	RelatedType      *string    `json:"related_type,omitempty" db:"related_type"`
	RelatedID        *uuid.UUID `json:"related_id,omitempty" db:"related_id"`
	Status           string     `json:"status" db:"status"`
	SentAt           *time.Time `json:"sent_at,omitempty" db:"sent_at"`
	ReadAt           *time.Time `json:"read_at,omitempty" db:"read_at"`
	ErrorMessage     *string    `json:"error_message,omitempty" db:"error_message"`
	CreatedAt        time.Time  `json:"created_at" db:"created_at"`
}

type UserSession struct {
	ID                  uuid.UUID  `json:"id" db:"id"`
	UserID              uuid.UUID  `json:"user_id" db:"user_id"`
	TokenFamilyID       uuid.UUID  `json:"token_family_id" db:"token_family_id"`
	ReplacedBySessionID *uuid.UUID `json:"replaced_by_session_id,omitempty" db:"replaced_by_session_id"`
	ExpiresAt           time.Time  `json:"expires_at" db:"expires_at"`
	RevokedAt           *time.Time `json:"revoked_at,omitempty" db:"revoked_at"`
	CreatedAt           time.Time  `json:"created_at" db:"created_at"`
	LastUsedAt          *time.Time `json:"last_used_at,omitempty" db:"last_used_at"`
}

type ParkingSessionFeedback struct {
	ID             uuid.UUID `json:"id" db:"id"`
	SessionID      uuid.UUID `json:"session_id" db:"session_id"`
	UserID         uuid.UUID `json:"user_id" db:"user_id"`
	SawEnforcement bool      `json:"saw_enforcement" db:"saw_enforcement"`
	Latitude       float64   `json:"latitude" db:"latitude"`
	Longitude      float64   `json:"longitude" db:"longitude"`
	Notes          *string   `json:"notes,omitempty" db:"notes"`
	CreatedAt      time.Time `json:"created_at" db:"created_at"`
}
