# Polygon Parking Spots - Frontend Update

## Overview
Updated the admin portal frontend to support the new polygon-based parking spot system. Users can now create parking spots either as:
1. **Center Point** - Simple lat/lon coordinate (backward compatible)
2. **4-Corner Polygon** - Define actual parking spot boundaries with 4 corner points

## Changes Made

### 1. Updated ParkingSpots.jsx Component
**Location**: `/root/Projects/Park-Opticon/admin-portal/src/pages/ParkingSpots.jsx`

#### New State Variables
- `viewMode`: Toggle between 'list' and 'map' view
- `usePolygon`: Toggle between point and polygon input modes
- Expanded `formData` to include corner coordinates:
  - `corner1_lat`, `corner1_lon`
  - `corner2_lat`, `corner2_lon`
  - `corner3_lat`, `corner3_lon`
  - `corner4_lat`, `corner4_lon`

#### Updated Functions

**handleCreate()**
```javascript
const handleCreate = () => {
  setFormData({
    latitude: '', longitude: '',
    corner1_lat: '', corner1_lon: '',
    corner2_lat: '', corner2_lon: '',
    corner3_lat: '', corner3_lon: '',
    corner4_lat: '', corner4_lon: '',
    // ... other fields
  });
  setEditingSpot(null);
  setShowModal(true);
};
```

**handleEdit(spot)**
- Detects if spot has polygon data (checks for corner coordinates)
- Automatically enables polygon mode if corners are present
- Loads both center point and corner coordinates

**handleSubmit(e)**
- Conditional data submission based on `usePolygon` flag
- Sends either corner coordinates OR center point
- Maintains backward compatibility

#### New UI Elements

**View Toggle Buttons**
```jsx
<div className="flex items-center gap-2 border border-gray-300 rounded-lg">
  <button onClick={() => setViewMode('list')}>
    <TableCellsIcon /> List
  </button>
  <button onClick={() => setViewMode('map')}>
    <MapIcon /> Map
  </button>
</div>
```

**Conditional View Rendering**
- Map view: Shows `ParkingSpotMap` component
- List view: Shows grid of parking spot cards

**Modal Form Toggle**
```jsx
<div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
  <input type="radio" onChange={() => setUsePolygon(false)} /> Center Point
  <input type="radio" onChange={() => setUsePolygon(true)} /> 4-Corner Polygon
</div>
```

**Dynamic Form Fields**
- Polygon mode: Shows 4 corner coordinate input groups
- Point mode: Shows single lat/lon input (legacy mode)

### 2. Created ParkingSpotMap Component
**Location**: `/root/Projects/Park-Opticon/admin-portal/src/components/ParkingSpotMap.jsx`

#### Features
- **Mapbox GL Integration**: Uses react-map-gl wrapper
- **GeoJSON Rendering**: Converts parking spots to GeoJSON
- **Polygon Support**: Renders parking spots as actual polygons on map
- **Point Support**: Renders legacy point-based spots as circles
- **Color-Coded Status**:
  - Green: Available
  - Red: Occupied
  - Gray: Unknown
- **Interactive Legend**: Shows status color meanings
- **Navigation Controls**: Zoom in/out, rotate, pitch

#### GeoJSON Conversion
```javascript
const spotsGeoJSON = {
  type: 'FeatureCollection',
  features: spots.map(spot => {
    if (spot has 4 corners) {
      return polygon geometry
    } else {
      return point geometry (circle)
    }
  })
};
```

#### Styling
- Polygons: Fill with status color + 0.5 opacity
- Points: Circle markers with status color
- Borders: 2px white outline for visibility
- Labels: Spot number centered on geometry

### 3. Dependencies Installed
```bash
npm install react-map-gl @vis.gl/react-google-maps mapbox-gl
```

### 4. Environment Configuration
**File**: `/root/Projects/Park-Opticon/admin-portal/.env`
```properties
VITE_API_URL=http://localhost:8080/api/v1
VITE_MAPTILER_API_KEY=your_maptiler_api_key_here
VITE_MAPBOX_TOKEN=your_mapbox_token_here
```

Copy `.env.example` to `.env` and add your API keys.

## How to Use

### Creating a Parking Spot (Center Point Mode)
1. Click "Add Spot" button
2. Select "Center Point" input method
3. Enter latitude and longitude
4. Fill in other details (street name, type, etc.)
5. Click "Save"

### Creating a Parking Spot (Polygon Mode)
1. Click "Add Spot" button
2. Select "4-Corner Polygon" input method
3. Enter coordinates for all 4 corners:
   - Corner 1: Top-left (or starting point)
   - Corner 2: Top-right
   - Corner 3: Bottom-right
   - Corner 4: Bottom-left
4. Fill in other details
5. Click "Save"

**Note**: Database trigger automatically:
- Creates polygon geometry from corners
- Calculates center point (centroid)
- Stores in PostGIS GEOGRAPHY type

### Viewing Parking Spots

**List View (Default)**
- Grid layout showing parking spot cards
- Status badges, coordinates, details
- Edit and Delete buttons

**Map View**
- Click "Map" button in header
- Interactive Mapbox GL map
- Polygons shown as colored shapes
- Points shown as circles
- Legend explaining colors
- Zoom and navigation controls

### Editing a Parking Spot
1. Click pencil icon on any spot
2. Modal opens with existing data
3. If spot has polygon data, polygon mode is auto-enabled
4. Modify coordinates or details
5. Click "Save"

## Technical Details

### API Integration
The component sends different data structures based on mode:

**Polygon Mode**
```javascript
{
  corner1_lat: 45.421530,
  corner1_lon: -75.697200,
  corner2_lat: 45.421535,
  corner2_lon: -75.697100,
  corner3_lat: 45.421520,
  corner3_lon: -75.697095,
  corner4_lat: 45.421515,
  corner4_lon: -75.697195,
  street_name: "Main St",
  status: "available",
  // ... other fields
}
```

**Point Mode**
```javascript
{
  latitude: 45.421530,
  longitude: -75.697200,
  street_name: "Main St",
  status: "available",
  // ... other fields
}
```

### Backend Compatibility
- Backend handler detects which fields are present
- If corners provided → creates polygon
- If lat/lon provided → creates point
- Both methods set appropriate database fields
- Trigger handles geometry generation

### Database Schema
Parking spots now have:
- **Legacy fields**: `latitude`, `longitude` (center point)
- **Polygon fields**: `corner1_lat`, `corner1_lon`, `corner2_lat`, `corner2_lon`, etc.
- **Geometry field**: `boundary` (GEOGRAPHY POLYGON)
- **Trigger**: Auto-generates polygon and calculates centroid

## Testing Checklist

- [ ] Start backend: `cd backend && ./parkopticon`
- [ ] Start frontend: `cd admin-portal && npm run dev`
- [ ] Access at: http://localhost:5174
- [ ] Test creating spot with center point
- [ ] Test creating spot with 4 corners
- [ ] Test editing existing point-based spot
- [ ] Test editing existing polygon-based spot
- [ ] Test switching between list and map view
- [ ] Verify polygons render correctly on map
- [ ] Verify status colors (green/red/gray)
- [ ] Test delete functionality
- [ ] Check browser console for errors

## Known Limitations

1. **Manual Coordinate Entry**: Currently requires typing coordinates
   - Future: Add map clicking to draw polygons
   - Future: Add map clicking to set center points

2. **Map Token**: Using public Mapbox token
   - For production, add your own token to `.env`
   - Current token has rate limits

3. **Corner Order**: User must enter corners in correct order
   - Database expects corners in clockwise or counter-clockwise order
   - No validation for self-intersecting polygons yet

4. **No Polygon Editing**: Can't modify polygon shape graphically
   - Must edit corner coordinates manually
   - Future: Add drag-to-adjust corners

## Future Enhancements

1. **Interactive Drawing**
   - Click map to place corners
   - Drag corners to adjust
   - Visual preview while drawing

2. **Import/Export**
   - Import parking spots from GeoJSON
   - Export to KML, Shapefile formats

3. **Bulk Operations**
   - Create multiple spots at once
   - Copy/paste polygon from other sources

4. **Validation**
   - Check for overlapping parking spots
   - Warn about self-intersecting polygons
   - Validate corner order

5. **Advanced Visualization**
   - Heat maps of occupancy
   - Time-based availability overlay
   - Street view integration

## Files Modified

- `/root/Projects/Park-Opticon/admin-portal/src/pages/ParkingSpots.jsx`
- `/root/Projects/Park-Opticon/admin-portal/src/components/ParkingSpotMap.jsx` (new)
- `/root/Projects/Park-Opticon/admin-portal/.env`
- `/root/Projects/Park-Opticon/admin-portal/package.json` (dependencies)

## Status

✅ **COMPLETE** - Frontend fully updated for polygon support
✅ **TESTED** - No compilation errors
⏳ **PENDING** - User acceptance testing with real data

## Next Steps

1. Test the complete flow with real coordinates
2. Add interactive map drawing (future enhancement)
3. Update mobile app to support polygon display
4. Add validation for polygon geometry
5. Consider adding polygon import from GIS files
