-- Expand parked-car alert preferences to 2.5 km while preserving existing
-- saved values. New users receive the 1 km default.

ALTER TABLE users
    ALTER COLUMN notification_radius_meters SET DEFAULT 1000;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_notification_radius_check;
ALTER TABLE users
    ADD CONSTRAINT users_notification_radius_check
    CHECK (notification_radius_meters BETWEEN 100 AND 2500);
