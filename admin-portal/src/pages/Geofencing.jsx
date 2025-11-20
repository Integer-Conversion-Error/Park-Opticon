import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet-draw';
import { getParkingSpots, createGeofence, updateGeofence, deleteGeofence } from '../api/client';

// Fix Leaflet default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function DrawControl({ onPolygonCreated, selectedSpot }) {
  const map = useMap();
  const drawControlRef = useRef(null);

  useEffect(() => {
    if (!map) return;

    // Initialize FeatureGroup to store editable layers
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    // Initialize draw control
    const drawControl = new L.Control.Draw({
      position: 'topright',
      draw: {
        polygon: selectedSpot ? {
          allowIntersection: false,
          drawError: {
            color: '#e1e100',
            message: '<strong>Error:</strong> Polygon edges cannot cross!',
          },
          shapeOptions: {
            color: '#3b82f6',
            weight: 2,
          },
        } : false,
        polyline: false,
        rectangle: false,
        circle: false,
        marker: false,
        circlemarker: false,
      },
      edit: {
        featureGroup: drawnItems,
        remove: true,
      },
    });

    map.addControl(drawControl);
    drawControlRef.current = drawControl;

    // Handle polygon creation
    map.on(L.Draw.Event.CREATED, (event) => {
      const layer = event.layer;
      drawnItems.addLayer(layer);
      
      const latlngs = layer.getLatLngs()[0];
      const coordinates = latlngs.map(ll => [ll.lng, ll.lat]);
      onPolygonCreated(coordinates);
    });

    return () => {
      map.removeControl(drawControl);
      map.removeLayer(drawnItems);
      map.off(L.Draw.Event.CREATED);
    };
  }, [map, onPolygonCreated, selectedSpot]);

  return null;
}

export default function Geofencing() {
  const [spots, setSpots] = useState([]);
  const [selectedSpot, setSelectedSpot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    loadSpots();
  }, []);

  const loadSpots = async () => {
    try {
      const response = await getParkingSpots();
      setSpots(response.data);
    } catch (error) {
      console.error('Failed to load parking spots:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePolygonCreated = async (coordinates) => {
    if (!selectedSpot) {
      setMessage({ type: 'error', text: 'Please select a parking spot first' });
      return;
    }

    try {
      // Close the polygon by adding the first point at the end
      const closedCoordinates = [...coordinates, coordinates[0]];
      
      if (selectedSpot.geofence) {
        await updateGeofence(selectedSpot.id, closedCoordinates);
        setMessage({ type: 'success', text: 'Geofence updated successfully' });
      } else {
        await createGeofence(selectedSpot.id, closedCoordinates);
        setMessage({ type: 'success', text: 'Geofence created successfully' });
      }
      
      await loadSpots();
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to save geofence' });
    }
  };

  const handleDeleteGeofence = async (spotId) => {
    if (!confirm('Are you sure you want to delete this geofence?')) return;

    try {
      await deleteGeofence(spotId);
      setMessage({ type: 'success', text: 'Geofence deleted successfully' });
      await loadSpots();
      if (selectedSpot?.id === spotId) {
        setSelectedSpot(null);
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to delete geofence' });
    }
  };

  const center = [37.7749, -122.4194]; // San Francisco

  if (loading) {
    return <div className="text-center py-12">Loading geofencing...</div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Geofencing Management</h1>

      {message.text && (
        <div className={`mb-4 p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Parking spots list */}
        <div className="lg:col-span-1 bg-white rounded-lg shadow p-4 max-h-[calc(100vh-12rem)] overflow-y-auto">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Parking Spots</h2>
          <div className="space-y-2">
            {spots.map((spot) => (
              <div
                key={spot.id}
                onClick={() => setSelectedSpot(spot)}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedSpot?.id === spot.id
                    ? 'bg-blue-50 border-2 border-blue-500'
                    : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                }`}
              >
                <div className="font-medium text-gray-900 text-sm">{spot.street_name}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {spot.geofence ? (
                    <span className="text-green-600">✓ Geofenced</span>
                  ) : (
                    <span className="text-gray-400">No geofence</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Map */}
        <div className="lg:col-span-3 bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 bg-gray-50 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {selectedSpot ? selectedSpot.street_name : 'Select a parking spot'}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedSpot 
                    ? 'Draw a polygon around the parking spot area' 
                    : 'Click a parking spot from the list to start drawing'}
                </p>
              </div>
              {selectedSpot?.geofence && (
                <button
                  onClick={() => handleDeleteGeofence(selectedSpot.id)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                >
                  Delete Geofence
                </button>
              )}
            </div>
          </div>

          <div className="h-[calc(100vh-16rem)]">
            <MapContainer
              center={center}
              zoom={13}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <DrawControl 
                onPolygonCreated={handlePolygonCreated}
                selectedSpot={selectedSpot}
              />

              {/* Display parking spots as markers */}
              {spots.map((spot) => (
                <Marker
                  key={spot.id}
                  position={[spot.latitude, spot.longitude]}
                  eventHandlers={{
                    click: () => setSelectedSpot(spot),
                  }}
                >
                  <Popup>
                    <div className="text-sm">
                      <div className="font-semibold">{spot.street_name}</div>
                      <div className="text-gray-600">{spot.availability}</div>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* Display existing geofences */}
              {spots
                .filter((spot) => spot.geofence)
                .map((spot) => {
                  // Convert coordinates to [lat, lng] format for Leaflet
                  const positions = spot.geofence.coordinates[0].map(coord => [coord[1], coord[0]]);
                  return (
                    <Polygon
                      key={`geofence-${spot.id}`}
                      positions={positions}
                      pathOptions={{
                        color: selectedSpot?.id === spot.id ? '#3b82f6' : '#10b981',
                        fillColor: selectedSpot?.id === spot.id ? '#3b82f6' : '#10b981',
                        fillOpacity: 0.2,
                        weight: 2,
                      }}
                    />
                  );
                })}
            </MapContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
