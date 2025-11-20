# Parking Spots Polygon Schema Update

## Overview
Parking spots now support polygon geometry, allowing them to be represented as actual rectangular areas on a map with 4 corner points, rather than just a single center point.

## Database Changes

### New Columns in `parking_spots` table:
- `boundary` - GEOGRAPHY(POLYGON, 4326) - The actual polygon geometry
- `corner1_lat`, `corner1_lon` - First corner (top-left)
- `corner2_lat`, `corner2_lon` - Second corner (top-right)  
- `corner3_lat`, `corner3_lon` - Third corner (bottom-right)
- `corner4_lat`, `corner4_lon` - Fourth corner (bottom-left)

### Automatic Behavior:
When you insert a parking spot with 4 corners, a database trigger automatically:
1. Creates the `boundary` polygon from the 4 corners
2. Calculates the centroid and updates `latitude`/`longitude` 
3. Creates the `location` point geography from the centroid

## API Usage

### Creating a Parking Spot with Polygon (NEW):

```json
POST /api/v1/admin/parking-spots
{
  "corner1_lat": 45.4230,
  "corner1_lon": -75.6800,
  "corner2_lat": 45.4230,
  "corner2_lon": -75.6798,
  "corner3_lat": 45.4228,
  "corner3_lon": -75.6798,
  "corner4_lat": 45.4228,
  "corner4_lon": -75.6800,
  "street_name": "Main Street",
  "address": "123 Main St",
  "spot_type": "street",
  "status": "available"
}
```

### Creating a Parking Spot with Center Point (BACKWARDS COMPATIBLE):

```json
POST /api/v1/admin/parking-spots
{
  "latitude": 45.4229,
  "longitude": -75.6799,
  "street_name": "Main Street",
  "address": "123 Main St",
  "spot_type": "street",
  "status": "available"
}
```

## Response Format

Both methods return the same response with all fields:

```json
{
  "id": "uuid",
  "latitude": 45.4229,
  "longitude": -75.6799,
  "corner1_lat": 45.4230,
  "corner1_lon": -75.6800,
  "corner2_lat": 45.4230,
  "corner2_lon": -75.6798,
  "corner3_lat": 45.4228,
  "corner3_lon": -75.6798,
  "corner4_lat": 45.4228,
  "corner4_lon": -75.6800,
  "street_name": "Main Street",
  "address": "123 Main St",
  "spot_type": "street",
  "status": "available",
  "created_at": "2025-11-10T14:00:00Z",
  ...
}
```

## Frontend Integration

### Rendering on Map:

```javascript
// If parking spot has corner coordinates, render as polygon
if (spot.corner1_lat && spot.corner1_lon && 
    spot.corner2_lat && spot.corner2_lon &&
    spot.corner3_lat && spot.corner3_lon &&
    spot.corner4_lat && spot.corner4_lon) {
  
  const coordinates = [
    [spot.corner1_lon, spot.corner1_lat],
    [spot.corner2_lon, spot.corner2_lat],
    [spot.corner3_lon, spot.corner3_lat],
    [spot.corner4_lon, spot.corner4_lat],
    [spot.corner1_lon, spot.corner1_lat] // Close the polygon
  ];
  
  // Render polygon on map
  addPolygonToMap(coordinates);
  
} else {
  // Fallback to point marker for old data
  addMarkerToMap(spot.latitude, spot.longitude);
}
```

### Creating Parking Spots with Drawing Tool:

```javascript
// When user draws a rectangle on the map
map.on('draw.create', function(e) {
  const coordinates = e.features[0].geometry.coordinates[0];
  
  // Extract the 4 corners
  const [corner1, corner2, corner3, corner4] = coordinates;
  
  // Create parking spot
  createParkingSpot({
    corner1_lat: corner1[1],
    corner1_lon: corner1[0],
    corner2_lat: corner2[1],
    corner2_lon: corner2[0],
    corner3_lat: corner3[1],
    corner3_lon: corner3[0],
    corner4_lat: corner4[1],
    corner4_lon: corner4[0],
    // ... other fields
  });
});
```

## Migration Applied

The migration `002_parking_spots_polygon.sql` has been applied to the database. All existing parking spots remain unchanged (they only have center points), and new spots can be created with either method.

## Benefits

1. **Accurate Representation**: Shows actual parking spot boundaries
2. **Better UX**: Users can see exactly where to park
3. **Collision Detection**: Can check if a vehicle is within the parking spot polygon
4. **Area Calculation**: Can calculate the actual size of parking spots
5. **Backwards Compatible**: Existing API calls still work

## Next Steps

1. Update admin portal UI to support drawing polygon parking spots
2. Update mobile app to render polygons on map
3. Consider adding validation for polygon size (min/max area)
4. Add map drawing tools for creating spots
