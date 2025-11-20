-- Migration 004: Add parking spot templates and enforcement schedules

-- Parking spot templates for reusable spot configurations
CREATE TABLE IF NOT EXISTS parking_spot_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    spot_type VARCHAR(50),
    duration_estimate INTEGER,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enforcement schedules for parking spots (can be associated with spots or templates)
CREATE TABLE IF NOT EXISTS enforcement_schedules (
    id SERIAL PRIMARY KEY,
    parking_spot_id INTEGER REFERENCES parking_spots(id) ON DELETE CASCADE,
    template_id INTEGER REFERENCES parking_spot_templates(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL, -- 0=Sunday, 1=Monday, ..., 6=Saturday
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    schedule_type VARCHAR(50) NOT NULL, -- 'enforced', 'no_parking', 'no_stopping', 'free'
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_day_of_week CHECK (day_of_week >= 0 AND day_of_week <= 6),
    CONSTRAINT check_schedule_type CHECK (schedule_type IN ('enforced', 'no_parking', 'no_stopping', 'free')),
    CONSTRAINT check_has_spot_or_template CHECK (
        (parking_spot_id IS NOT NULL AND template_id IS NULL) OR
        (parking_spot_id IS NULL AND template_id IS NOT NULL)
    )
);

-- Add template reference to parking_spots
ALTER TABLE parking_spots ADD COLUMN IF NOT EXISTS template_id INTEGER REFERENCES parking_spot_templates(id) ON DELETE SET NULL;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_enforcement_schedules_spot ON enforcement_schedules(parking_spot_id);
CREATE INDEX IF NOT EXISTS idx_enforcement_schedules_template ON enforcement_schedules(template_id);
CREATE INDEX IF NOT EXISTS idx_enforcement_schedules_day ON enforcement_schedules(day_of_week);
CREATE INDEX IF NOT EXISTS idx_parking_spots_template ON parking_spots(template_id);

-- Insert some sample templates
INSERT INTO parking_spot_templates (name, description, spot_type, duration_estimate, notes)
VALUES 
    ('Standard Street Parking', 'Regular metered street parking with 2-hour limit', 'street', 120, 'Enforced Mon-Fri 8am-6pm'),
    ('Residential Permit Zone', 'Permit-only parking for residents', 'street', NULL, 'No parking without permit'),
    ('Loading Zone', '15-minute loading zone for deliveries', 'street', 15, 'No parking, loading only'),
    ('Free Weekend Parking', 'Free parking on weekends', 'street', NULL, 'Free Sat-Sun, enforced weekdays')
ON CONFLICT (name) DO NOTHING;

-- Insert sample enforcement schedules for templates
-- Standard Street Parking: Enforced Mon-Fri 8am-6pm, Free weekends
INSERT INTO enforcement_schedules (template_id, day_of_week, start_time, end_time, schedule_type, description)
SELECT id, 1, '08:00:00', '18:00:00', 'enforced', 'Monday enforcement'
FROM parking_spot_templates WHERE name = 'Standard Street Parking'
UNION ALL
SELECT id, 2, '08:00:00', '18:00:00', 'enforced', 'Tuesday enforcement'
FROM parking_spot_templates WHERE name = 'Standard Street Parking'
UNION ALL
SELECT id, 3, '08:00:00', '18:00:00', 'enforced', 'Wednesday enforcement'
FROM parking_spot_templates WHERE name = 'Standard Street Parking'
UNION ALL
SELECT id, 4, '08:00:00', '18:00:00', 'enforced', 'Thursday enforcement'
FROM parking_spot_templates WHERE name = 'Standard Street Parking'
UNION ALL
SELECT id, 5, '08:00:00', '18:00:00', 'enforced', 'Friday enforcement'
FROM parking_spot_templates WHERE name = 'Standard Street Parking'
UNION ALL
SELECT id, 0, '00:00:00', '23:59:59', 'free', 'Sunday free parking'
FROM parking_spot_templates WHERE name = 'Standard Street Parking'
UNION ALL
SELECT id, 6, '00:00:00', '23:59:59', 'free', 'Saturday free parking'
FROM parking_spot_templates WHERE name = 'Standard Street Parking';

-- Loading Zone: No parking all week 7am-7pm, loading only
INSERT INTO enforcement_schedules (template_id, day_of_week, start_time, end_time, schedule_type, description)
SELECT id, gs.day, '07:00:00', '19:00:00', 'no_parking', 'Loading only'
FROM parking_spot_templates, generate_series(0, 6) gs(day)
WHERE name = 'Loading Zone';
