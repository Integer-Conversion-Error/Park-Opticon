-- Normalize legacy geofence columns to the runtime API's GeoJSON Polygon type.
-- Older bootstrap installs used geography(MULTIPOLYGON), while the runtime API
-- accepts and returns a single geometry(POLYGON).

-- Fresh bootstrap schemas already use geometry(POLYGON, 4326). Avoid an
-- unnecessary ALTER because active_parking_spots depends on this column.
-- Legacy geography columns still take the conversion path below.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_attribute attribute
        WHERE attribute.attrelid = 'public.parking_spots'::regclass
          AND attribute.attname = 'geofence'
          AND NOT attribute.attisdropped
          AND attribute.atttypid <> 'geometry'::regtype
    ) THEN
        ALTER TABLE parking_spots
            ALTER COLUMN geofence TYPE GEOMETRY(POLYGON, 4326)
            USING CASE
                WHEN geofence IS NULL THEN NULL
                WHEN GeometryType(geofence::geometry) = 'MULTIPOLYGON'
                    THEN ST_GeometryN(geofence::geometry, 1)
                ELSE geofence::geometry
            END;
    END IF;
END $$;
