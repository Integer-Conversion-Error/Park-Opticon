package mockdata

import (
	"time"

	"github.com/google/uuid"
	"github.com/solace-esadnkaya/parkopticon-backend/internal/models"
)

// Mock users for testing
var MockUsers = []models.User{
	{
		ID:                       uuid.MustParse("123e4567-e89b-12d3-a456-426614174000"),
		Email:                    "demo@parkopticon.com",
		Username:                 "demo_user",
		FullName:                 stringPtr("Demo User"),
		KarmaPoints:              150,
		NotificationsEnabled:     true,
		EnforcementAlertsEnabled: true,
		ParkingRadiusMiles:       0.5,
		EmailVerified:            true,
		IsActive:                 true,
		IsAdmin:                  false,
		CreatedAt:                time.Now().Add(-30 * 24 * time.Hour),
		UpdatedAt:                time.Now(),
	},
	{
		ID:                       uuid.MustParse("223e4567-e89b-12d3-a456-426614174001"),
		Email:                    "john@example.com",
		Username:                 "john_parker",
		FullName:                 stringPtr("John Parker"),
		KarmaPoints:              75,
		NotificationsEnabled:     true,
		EnforcementAlertsEnabled: true,
		ParkingRadiusMiles:       1.0,
		EmailVerified:            true,
		IsActive:                 true,
		IsAdmin:                  true,
		CreatedAt:                time.Now().Add(-15 * 24 * time.Hour),
		UpdatedAt:                time.Now(),
	},
}

// Mock parking spots (San Francisco area)
var MockParkingSpots = []models.ParkingSpot{
	{
		ID:               uuid.MustParse("323e4567-e89b-12d3-a456-426614174002"),
		ReporterID:       &MockUsers[0].ID,
		Latitude:         37.7749,
		Longitude:        -122.4194,
		Address:          stringPtr("123 Market St, San Francisco, CA"),
		StreetName:       stringPtr("Market Street"),
		SpotType:         stringPtr("street"),
		DurationEstimate: intPtr(120),
		Notes:            stringPtr("Easy parallel parking spot"),
		Status:           "available",
		VerifiedByCount:  3,
		FlaggedCount:     0,
		CreatedAt:        time.Now().Add(-10 * time.Minute),
		ExpiresAt:        timePtr(time.Now().Add(2 * time.Hour)),
		DistanceMiles:    float64Ptr(0.2),
	},
	{
		ID:               uuid.MustParse("423e4567-e89b-12d3-a456-426614174003"),
		ReporterID:       &MockUsers[1].ID,
		Latitude:         37.7833,
		Longitude:        -122.4167,
		Address:          stringPtr("456 Mission St, San Francisco, CA"),
		StreetName:       stringPtr("Mission Street"),
		SpotType:         stringPtr("street"),
		DurationEstimate: intPtr(60),
		Notes:            stringPtr("Metered parking, 2 hour limit"),
		Status:           "available",
		VerifiedByCount:  5,
		FlaggedCount:     0,
		CreatedAt:        time.Now().Add(-25 * time.Minute),
		ExpiresAt:        timePtr(time.Now().Add(90 * time.Minute)),
		DistanceMiles:    float64Ptr(0.5),
	},
	{
		ID:               uuid.MustParse("523e4567-e89b-12d3-a456-426614174004"),
		ReporterID:       &MockUsers[0].ID,
		Latitude:         37.7899,
		Longitude:        -122.4100,
		Address:          stringPtr("789 Howard St, San Francisco, CA"),
		StreetName:       stringPtr("Howard Street"),
		SpotType:         stringPtr("garage"),
		DurationEstimate: intPtr(240),
		Notes:            stringPtr("Parking garage, $15/hour"),
		Status:           "available",
		VerifiedByCount:  1,
		FlaggedCount:     0,
		CreatedAt:        time.Now().Add(-5 * time.Minute),
		ExpiresAt:        timePtr(time.Now().Add(4 * time.Hour)),
		DistanceMiles:    float64Ptr(0.8),
	},
	{
		ID:               uuid.MustParse("623e4567-e89b-12d3-a456-426614174005"),
		ReporterID:       &MockUsers[1].ID,
		Latitude:         37.7700,
		Longitude:        -122.4250,
		Address:          stringPtr("321 Valencia St, San Francisco, CA"),
		StreetName:       stringPtr("Valencia Street"),
		SpotType:         stringPtr("street"),
		DurationEstimate: intPtr(180),
		Notes:            stringPtr("Free parking after 6pm"),
		Status:           "available",
		VerifiedByCount:  2,
		FlaggedCount:     0,
		CreatedAt:        time.Now().Add(-15 * time.Minute),
		ExpiresAt:        timePtr(time.Now().Add(3 * time.Hour)),
		DistanceMiles:    float64Ptr(0.3),
	},
}

// Mock enforcement alerts
var MockEnforcementAlerts = []models.EnforcementAlert{
	{
		ID:              uuid.MustParse("723e4567-e89b-12d3-a456-426614174006"),
		ReporterID:      &MockUsers[0].ID,
		Latitude:        37.7750,
		Longitude:       -122.4183,
		Address:         stringPtr("100 Market St, San Francisco, CA"),
		StreetName:      stringPtr("Market Street"),
		EnforcementType: "parking_enforcement",
		Description:     "Parking enforcement officer spotted writing tickets",
		Severity:        "medium",
		Status:          "active",
		VerifiedByCount: 4,
		FlaggedCount:    0,
		CreatedAt:       time.Now().Add(-5 * time.Minute),
		ExpiresAt:       time.Now().Add(30 * time.Minute),
		DistanceMiles:   float64Ptr(0.1),
	},
	{
		ID:              uuid.MustParse("823e4567-e89b-12d3-a456-426614174007"),
		ReporterID:      &MockUsers[1].ID,
		Latitude:        37.7820,
		Longitude:       -122.4200,
		Address:         stringPtr("500 Mission St, San Francisco, CA"),
		StreetName:      stringPtr("Mission Street"),
		EnforcementType: "tow_truck",
		Description:     "Tow truck actively towing vehicles",
		Severity:        "high",
		Status:          "active",
		VerifiedByCount: 8,
		FlaggedCount:    0,
		CreatedAt:       time.Now().Add(-2 * time.Minute),
		ExpiresAt:       time.Now().Add(20 * time.Minute),
		DistanceMiles:   float64Ptr(0.4),
	},
	{
		ID:              uuid.MustParse("923e4567-e89b-12d3-a456-426614174008"),
		ReporterID:      &MockUsers[0].ID,
		Latitude:        37.7680,
		Longitude:       -122.4300,
		Address:         stringPtr("200 Valencia St, San Francisco, CA"),
		StreetName:      stringPtr("Valencia Street"),
		EnforcementType: "street_sweeping",
		Description:     "Street sweeping in progress, vehicles being ticketed",
		Severity:        "low",
		Status:          "active",
		VerifiedByCount: 2,
		FlaggedCount:    0,
		CreatedAt:       time.Now().Add(-8 * time.Minute),
		ExpiresAt:       time.Now().Add(15 * time.Minute),
		DistanceMiles:   float64Ptr(0.6),
	},
}

// Mock vehicles
var MockVehicles = []models.Vehicle{
	{
		ID:            uuid.MustParse("a23e4567-e89b-12d3-a456-426614174009"),
		UserID:        MockUsers[0].ID,
		Nickname:      stringPtr("My Honda"),
		Make:          stringPtr("Honda"),
		Model:         stringPtr("Civic"),
		Year:          intPtr(2020),
		Color:         stringPtr("Blue"),
		LicensePlate:  "ABC1234",
		StateProvince: stringPtr("CA"),
		IsDefault:     true,
		IsActive:      true,
		CreatedAt:     time.Now().Add(-30 * 24 * time.Hour),
		UpdatedAt:     time.Now(),
	},
	{
		ID:            uuid.MustParse("b23e4567-e89b-12d3-a456-426614174010"),
		UserID:        MockUsers[1].ID,
		Nickname:      stringPtr("The Truck"),
		Make:          stringPtr("Ford"),
		Model:         stringPtr("F-150"),
		Year:          intPtr(2019),
		Color:         stringPtr("Red"),
		LicensePlate:  "XYZ9876",
		StateProvince: stringPtr("CA"),
		IsDefault:     true,
		IsActive:      true,
		CreatedAt:     time.Now().Add(-20 * 24 * time.Hour),
		UpdatedAt:     time.Now(),
	},
}

// Mock parking sessions
var MockParkingSessions = []models.ParkingSession{
	{
		ID:                  uuid.MustParse("c23e4567-e89b-12d3-a456-426614174011"),
		UserID:              MockUsers[0].ID,
		VehicleID:           &MockVehicles[0].ID,
		Latitude:            37.7749,
		Longitude:           -122.4194,
		Address:             stringPtr("123 Market St, San Francisco, CA"),
		StartedAt:           time.Now().Add(-45 * time.Minute),
		IsActive:            true,
		AlertsReceivedCount: 1,
		CreatedAt:           time.Now().Add(-45 * time.Minute),
		UpdatedAt:           time.Now(),
	},
}

// Mock tickets
var MockTickets = []models.Ticket{
	{
		ID:                   uuid.MustParse("d23e4567-e89b-12d3-a456-426614174012"),
		UserID:               MockUsers[0].ID,
		VehicleID:            &MockVehicles[0].ID,
		TicketNumber:         stringPtr("PKG-2025-00123"),
		CitationNumber:       stringPtr("SF-456789"),
		ViolationType:        "expired_meter",
		ViolationDescription: stringPtr("Meter expired"),
		AmountCents:          7500, // $75.00
		Currency:             "USD",
		Latitude:             float64Ptr(37.7749),
		Longitude:            float64Ptr(-122.4194),
		Address:              stringPtr("Market St, San Francisco"),
		IssuedDate:           time.Now().Add(-7 * 24 * time.Hour),
		Status:               "unpaid",
		DueDate:              timePtr(time.Now().Add(21 * 24 * time.Hour)),
		CreatedAt:            time.Now().Add(-7 * 24 * time.Hour),
		UpdatedAt:            time.Now(),
	},
	{
		ID:                   uuid.MustParse("e23e4567-e89b-12d3-a456-426614174013"),
		UserID:               MockUsers[1].ID,
		VehicleID:            &MockVehicles[1].ID,
		TicketNumber:         stringPtr("PKG-2025-00098"),
		CitationNumber:       stringPtr("SF-445566"),
		ViolationType:        "street_sweeping",
		ViolationDescription: stringPtr("Parked during street cleaning"),
		AmountCents:          5000, // $50.00
		Currency:             "USD",
		Latitude:             float64Ptr(37.7820),
		Longitude:            float64Ptr(-122.4200),
		Address:              stringPtr("Mission St, San Francisco"),
		IssuedDate:           time.Now().Add(-14 * 24 * time.Hour),
		Status:               "paid",
		DueDate:              timePtr(time.Now().Add(7 * 24 * time.Hour)),
		PaidDate:             timePtr(time.Now().Add(-2 * 24 * time.Hour)),
		PaidAmountCents:      intPtr(5000),
		CreatedAt:            time.Now().Add(-14 * 24 * time.Hour),
		UpdatedAt:            time.Now().Add(-2 * 24 * time.Hour),
	},
}

// Helper functions
func stringPtr(s string) *string {
	return &s
}

func intPtr(i int) *int {
	return &i
}

func float64Ptr(f float64) *float64 {
	return &f
}

func timePtr(t time.Time) *time.Time {
	return &t
}

// GetMockUser returns a mock user by email
func GetMockUser(email string) *models.User {
	for _, user := range MockUsers {
		if user.Email == email {
			return &user
		}
	}
	return nil
}

// GetMockUserByID returns a mock user by ID
func GetMockUserByID(id uuid.UUID) *models.User {
	for _, user := range MockUsers {
		if user.ID == id {
			return &user
		}
	}
	return nil
}
