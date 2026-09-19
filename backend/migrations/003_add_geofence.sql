-- Migration: Add geofence column for parking spot polygons
-- This allows admins to draw precise geofences around parking spots

-- Check if geofence column exists, add it if it doesn't
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'parking_spots' AND column_name = 'geofence'
    ) THEN
        ALTER TABLE parking_spots 
        ADD COLUMN geofence GEOMETRY(POLYGON, 4326);
        
        -- Create index on geofence
        CREATE INDEX idx_parking_spots_geofence ON parking_spots USING GIST(geofence);
        
        RAISE NOTICE 'Added geofence column to parking_spots';
    ELSE
        RAISE NOTICE 'geofence column already exists';
    END IF;
END $$;

-- Add comment
COMMENT ON COLUMN parking_spots.geofence IS 'Precise polygon geofence drawn by admin to define parking spot boundary';
