-- Migration: Convert parking spots to use polygon geometry
-- This migration changes parking spots from point-based to polygon-based

-- Add new polygon column for parking spot boundary
ALTER TABLE parking_spots 
ADD COLUMN boundary GEOGRAPHY(POLYGON, 4326);

-- Add corner coordinates for easy access
ALTER TABLE parking_spots
ADD COLUMN corner1_lat DECIMAL(10, 8),
ADD COLUMN corner1_lon DECIMAL(11, 8),
ADD COLUMN corner2_lat DECIMAL(10, 8),
ADD COLUMN corner2_lon DECIMAL(11, 8),
ADD COLUMN corner3_lat DECIMAL(10, 8),
ADD COLUMN corner3_lon DECIMAL(11, 8),
ADD COLUMN corner4_lat DECIMAL(10, 8),
ADD COLUMN corner4_lon DECIMAL(11, 8);

-- Create index on boundary
CREATE INDEX idx_parking_spots_boundary ON parking_spots USING GIST(boundary);

-- Function to create polygon from 4 corners
CREATE OR REPLACE FUNCTION create_parking_spot_boundary()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.corner1_lat IS NOT NULL AND NEW.corner1_lon IS NOT NULL AND
       NEW.corner2_lat IS NOT NULL AND NEW.corner2_lon IS NOT NULL AND
       NEW.corner3_lat IS NOT NULL AND NEW.corner3_lon IS NOT NULL AND
       NEW.corner4_lat IS NOT NULL AND NEW.corner4_lon IS NOT NULL THEN
        
        -- Create polygon from 4 corners (must close the polygon by repeating first point)
        NEW.boundary = ST_GeogFromText(
            'POLYGON((' ||
            NEW.corner1_lon || ' ' || NEW.corner1_lat || ',' ||
            NEW.corner2_lon || ' ' || NEW.corner2_lat || ',' ||
            NEW.corner3_lon || ' ' || NEW.corner3_lat || ',' ||
            NEW.corner4_lon || ' ' || NEW.corner4_lat || ',' ||
            NEW.corner1_lon || ' ' || NEW.corner1_lat ||
            '))'
        );
        
        -- Update centroid location from polygon
        NEW.latitude = (NEW.corner1_lat + NEW.corner2_lat + NEW.corner3_lat + NEW.corner4_lat) / 4.0;
        NEW.longitude = (NEW.corner1_lon + NEW.corner2_lon + NEW.corner3_lon + NEW.corner4_lon) / 4.0;
        NEW.location = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate boundary from corners
CREATE TRIGGER create_parking_spot_boundary_trigger
BEFORE INSERT OR UPDATE ON parking_spots
FOR EACH ROW
EXECUTE FUNCTION create_parking_spot_boundary();

-- Add comment
COMMENT ON COLUMN parking_spots.boundary IS 'Polygon representing the parking spot area defined by 4 corners';
COMMENT ON COLUMN parking_spots.corner1_lat IS 'Latitude of first corner (top-left)';
COMMENT ON COLUMN parking_spots.corner1_lon IS 'Longitude of first corner (top-left)';
COMMENT ON COLUMN parking_spots.corner2_lat IS 'Latitude of second corner (top-right)';
COMMENT ON COLUMN parking_spots.corner2_lon IS 'Longitude of second corner (top-right)';
COMMENT ON COLUMN parking_spots.corner3_lat IS 'Latitude of third corner (bottom-right)';
COMMENT ON COLUMN parking_spots.corner3_lon IS 'Longitude of third corner (bottom-right)';
COMMENT ON COLUMN parking_spots.corner4_lat IS 'Latitude of fourth corner (bottom-left)';
COMMENT ON COLUMN parking_spots.corner4_lon IS 'Longitude of fourth corner (bottom-left)';

