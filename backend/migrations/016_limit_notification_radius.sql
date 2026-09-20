BEGIN;

-- Cap existing preferences before enforcing the reduced 1.5 km maximum.
-- The default stays at 1 km. Run atomically so concurrent writes cannot keep
-- an out-of-range preference between the update and the constraint change.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_notification_radius_check;

UPDATE users
SET notification_radius_meters = 1500, updated_at = CURRENT_TIMESTAMP
WHERE notification_radius_meters > 1500;

ALTER TABLE users
    ADD CONSTRAINT users_notification_radius_check
    CHECK (notification_radius_meters BETWEEN 100 AND 1500);

COMMIT;
