import { useEffect, useRef, useState } from 'react';
import Map, { Layer, Source, NavigationControl } from 'react-map-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import 'mapbox-gl/dist/mapbox-gl.css';

// You'll need to add your Mapbox token in .env as VITE_MAPBOX_TOKEN
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

export default function ParkingSpotMap({ spots = [], onGeofenceUpdate }) {
  const [viewState, setViewState] = useState({
    latitude: 45.4215,
    longitude: -75.6972,
    zoom: 18 // Increased zoom for better detail
  });
  
  const mapRef = useRef();
  const drawRef = useRef();

  // Initialize Mapbox Draw control
  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current.getMap();
    
    // Create draw control
    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        polygon: true,
        trash: true
      },
      defaultMode: 'simple_select',
      styles: [
        // Polygon fill
        {
          'id': 'gl-draw-polygon-fill',
          'type': 'fill',
          'filter': ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
          'paint': {
            'fill-color': '#3b82f6',
            'fill-outline-color': '#3b82f6',
            'fill-opacity': 0.3
          }
        },
        // Polygon outline
        {
          'id': 'gl-draw-polygon-stroke-active',
          'type': 'line',
          'filter': ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
          'layout': {
            'line-cap': 'round',
            'line-join': 'round'
          },
          'paint': {
            'line-color': '#3b82f6',
            'line-width': 2
          }
        },
        // Vertex points
        {
          'id': 'gl-draw-polygon-and-line-vertex-active',
          'type': 'circle',
          'filter': ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point']],
          'paint': {
            'circle-radius': 6,
            'circle-color': '#3b82f6'
          }
        }
      ]
    });

    map.addControl(draw, 'top-left');
    drawRef.current = draw;

    // Listen for draw events
    map.on('draw.create', (e) => {
      const feature = e.features[0];
      if (feature.geometry.type === 'Polygon' && onGeofenceUpdate) {
        // Get coordinates in correct GeoJSON format
        const coordinates = feature.geometry.coordinates;
        onGeofenceUpdate(coordinates);
        
        // Clear the drawing after sending
        draw.deleteAll();
      }
    });

    map.on('draw.update', (e) => {
      const feature = e.features[0];
      if (feature.geometry.type === 'Polygon' && onGeofenceUpdate) {
        const coordinates = feature.geometry.coordinates;
        onGeofenceUpdate(coordinates);
      }
    });

    return () => {
      if (drawRef.current && map) {
        map.removeControl(drawRef.current);
      }
    };
  }, [onGeofenceUpdate]);

  // Convert spots to GeoJSON
  const spotsGeoJSON = {
    type: 'FeatureCollection',
    features: spots.map(spot => {
      // Priority 1: Check if spot has a geofence (admin-drawn polygon)
      if (spot.geofence) {
        try {
          const geofenceObj = typeof spot.geofence === 'string' 
            ? JSON.parse(spot.geofence) 
            : spot.geofence;
          
          return {
            type: 'Feature',
            id: spot.id,
            geometry: geofenceObj,
            properties: {
              id: spot.id,
              status: spot.status,
              street_name: spot.street_name || 'Unknown',
              hasGeofence: true
            }
          };
        } catch {
          // Fall through to next option
        }
      }
      
      // Priority 2: Check if spot has polygon data (4 corners)
      if (spot.corner1_lat && spot.corner1_lon && 
          spot.corner2_lat && spot.corner2_lon &&
          spot.corner3_lat && spot.corner3_lon &&
          spot.corner4_lat && spot.corner4_lon) {
        // Create polygon
        return {
          type: 'Feature',
          id: spot.id,
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [spot.corner1_lon, spot.corner1_lat],
              [spot.corner2_lon, spot.corner2_lat],
              [spot.corner3_lon, spot.corner3_lat],
              [spot.corner4_lon, spot.corner4_lat],
              [spot.corner1_lon, spot.corner1_lat], // Close the polygon
            ]]
          },
          properties: {
            id: spot.id,
            status: spot.status,
            street_name: spot.street_name || 'Unknown'
          }
        };
      }
      
      // Priority 3: Fallback to point for spots without polygon data
      return {
        type: 'Feature',
        id: spot.id,
        geometry: {
          type: 'Point',
          coordinates: [spot.longitude, spot.latitude]
        },
        properties: {
          id: spot.id,
          status: spot.status,
          street_name: spot.street_name || 'Unknown'
        }
      };
    })
  };

  return (
    <div className="relative w-full h-full">
      <Map
        ref={mapRef}
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
        mapboxAccessToken={MAPBOX_TOKEN}
      >
        <NavigationControl position="top-right" />

        {/* Render parking spots */}
        <Source id="parking-spots" type="geojson" data={spotsGeoJSON}>
          {/* Geofence polygons with stronger styling */}
          <Layer
            id="parking-spots-geofence-fill"
            type="fill"
            filter={['==', ['get', 'hasGeofence'], true]}
            paint={{
              'fill-color': '#fbbf24', // Yellow/amber for geofences
              'fill-opacity': 0.4
            }}
          />
          <Layer
            id="parking-spots-geofence-outline"
            type="line"
            filter={['==', ['get', 'hasGeofence'], true]}
            paint={{
              'line-color': '#f59e0b',
              'line-width': 3
            }}
          />
          
          
          {/* Regular polygon fill */}
          <Layer
            id="parking-spots-fill"
            type="fill"
            filter={['!=', ['get', 'hasGeofence'], true]}
            paint={{
              'fill-color': [
                'match',
                ['get', 'status'],
                'available', '#10b981',
                'occupied', '#ef4444',
                'unknown', '#6b7280',
                '#9ca3af'
              ],
              'fill-opacity': 0.3
            }}
          />
          {/* Polygon outline */}
          <Layer
            id="parking-spots-outline"
            type="line"
            filter={['!=', ['get', 'hasGeofence'], true]}
            paint={{
              'line-color': [
                'match',
                ['get', 'status'],
                'available', '#059669',
                'occupied', '#dc2626',
                'unknown', '#4b5563',
                '#6b7280'
              ],
              'line-width': 2
            }}
          />
          {/* Points for old data */}
          <Layer
            id="parking-spots-points"
            type="circle"
            filter={['==', ['geometry-type'], 'Point']}
            paint={{
              'circle-radius': 8,
              'circle-color': [
                'match',
                ['get', 'status'],
                'available', '#10b981',
                'occupied', '#ef4444',
                'unknown', '#6b7280',
                '#9ca3af'
              ],
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff'
            }}
          />
        </Source>
      </Map>

      {/* Instructions */}
      <div className="absolute top-4 left-16 bg-white rounded-lg shadow-lg p-4 max-w-sm">
        <h3 className="text-sm font-semibold mb-2 text-gray-900">Draw Parking Spot Geofence</h3>
        <ol className="text-xs text-gray-600 space-y-1 list-decimal list-inside">
          <li>Click the polygon tool (⬡) on the left panel</li>
          <li>Click on the map to add points around the parking spot</li>
          <li>Double-click or click the first point to finish</li>
          <li>The geofence will be saved automatically</li>
          <li>Use the trash icon (🗑) to delete if needed</li>
        </ol>
        <p className="text-xs text-blue-600 mt-2 font-medium">💡 Satellite view helps see parking spots clearly</p>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-4">
        <h3 className="text-sm font-semibold mb-2">Status</h3>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded"></div>
            <span className="text-xs">Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 rounded"></div>
            <span className="text-xs">Occupied</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-500 rounded"></div>
            <span className="text-xs">Unknown</span>
          </div>
        </div>
      </div>
    </div>
  );
}
