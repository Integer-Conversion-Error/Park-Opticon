import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet-draw';
import { getParkingSpots, createParkingSpot, updateParkingSpot, deleteParkingSpot, createGeofence, updateGeofence, deleteGeofence, getTemplates } from '../api/client';
import { PlusIcon, PencilIcon, TrashIcon, XMarkIcon, ChevronDownIcon, BoltIcon } from '@heroicons/react/24/outline';

// Fix Leaflet default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function MapClickHandler({ onMapClick, isAddingMode, rapidFireMode }) {
  useMapEvents({
    click: (e) => {
      if (isAddingMode || rapidFireMode) {
        onMapClick(e.latlng);
      }
    },
  });
  return null;
}

function DrawControl({ onPolygonCreated, selectedSpot }) {
  const map = useMap();
  const drawControlRef = useRef(null);

  useEffect(() => {
    if (!map) return;

    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

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
        rectangle: selectedSpot ? {
          shapeOptions: {
            color: '#3b82f6',
            weight: 2,
          },
        } : false,
        polyline: false,
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

export default function MapManager() {
  const [spots, setSpots] = useState([]);
  const [selectedSpot, setSelectedSpot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [isAddingMode, setIsAddingMode] = useState(false);
  const [showSpotModal, setShowSpotModal] = useState(false);
  const [newSpotLocation, setNewSpotLocation] = useState(null);
  const [parkingSpaces, setParkingSpaces] = useState([]); // Multiple polygons for individual spaces
  const [openStreets, setOpenStreets] = useState({}); // Track which streets are expanded
  const [editingSpot, setEditingSpot] = useState(null); // Track which spot is being edited
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [rapidFireMode, setRapidFireMode] = useState(false);
  const [formData, setFormData] = useState({
    street_name: '',
    address: '',
    spot_type: 'street',
    duration_estimate: '',
    notes: '',
    status: 'available',
  });

  useEffect(() => {
    loadSpots();
    loadTemplates();
  }, []);

  // Load all geofences when spots are loaded
  useEffect(() => {
    loadAllGeofences();
  }, [spots]);

  const loadSpots = async () => {
    try {
      const response = await getParkingSpots();
      setSpots(response.data || []);
    } catch (error) {
      console.error('Failed to load parking spots:', error);
      setSpots([]);
    } finally {
      setLoading(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const response = await getTemplates();
      setTemplates(response.data || []);
    } catch (error) {
      console.error('Failed to load templates:', error);
      setTemplates([]);
    }
  };

  const reverseGeocode = async (lat, lng) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'Park-Opticon-Admin-Portal',
          },
        }
      );
      const data = await response.json();
      
      // Extract street name and full address
      const address = data.address || {};
      const streetName = address.road || address.street || address.pedestrian || '';
      const houseNumber = address.house_number || '';
      const fullAddress = data.display_name || '';
      
      return {
        streetName: streetName,
        fullAddress: houseNumber ? `${houseNumber} ${streetName}` : fullAddress,
      };
    } catch (error) {
      console.error('Reverse geocoding failed:', error);
      return { streetName: '', fullAddress: '' };
    }
  };

  // Format time to HH:MM:SS (handles both HH:MM:SS and ISO formats)
  const formatTimeForBackend = (timeString) => {
    if (!timeString) return '';
    // If it's an ISO timestamp, extract the time part
    if (timeString.includes('T')) {
      const date = new Date(timeString);
      const hours = String(date.getUTCHours()).padStart(2, '0');
      const minutes = String(date.getUTCMinutes()).padStart(2, '0');
      const seconds = String(date.getUTCSeconds()).padStart(2, '0');
      return `${hours}:${minutes}:${seconds}`;
    }
    // If it's already HH:MM:SS or HH:MM, ensure it's HH:MM:SS
    if (timeString.length === 5) {
      return `${timeString}:00`;
    }
    return timeString;
  };

  const handleMapClick = async (latlng) => {
    if (rapidFireMode && selectedTemplate) {
      // Rapid fire mode: create spot immediately using template
      await createSpotFromTemplate(latlng, selectedTemplate);
    } else {
      // Normal mode: show modal
      setNewSpotLocation(latlng);
      
      // Show loading state
      setFormData({
        street_name: 'Loading...',
        address: 'Loading...',
        spot_type: 'street',
        duration_estimate: '',
        notes: '',
        status: 'available',
      });
      setShowSpotModal(true);
      setIsAddingMode(false);

      // Fetch address from coordinates
      const { streetName, fullAddress } = await reverseGeocode(latlng.lat, latlng.lng);
      
      setFormData({
        street_name: streetName,
        address: fullAddress,
        spot_type: 'street',
        duration_estimate: '',
        notes: '',
        status: 'available',
      });
    }
  };

  const createSpotFromTemplate = async (latlng, template) => {
    try {
      // Get address
      const { streetName, fullAddress } = await reverseGeocode(latlng.lat, latlng.lng);

      // Format schedules to ensure correct time format
      const formattedSchedules = (template.schedules || []).map(schedule => ({
        day_of_week: schedule.day_of_week,
        start_time: formatTimeForBackend(schedule.start_time),
        end_time: formatTimeForBackend(schedule.end_time),
        schedule_type: schedule.schedule_type,
        description: schedule.description || null,
      }));

      // Create spot using template data
      const data = {
        latitude: latlng.lat,
        longitude: latlng.lng,
        street_name: streetName,
        address: fullAddress,
        spot_type: template.spot_type || 'street',
        duration_estimate: template.duration_estimate || null,
        notes: template.notes || null,
        status: 'available',
        template_id: template.id,
        schedules: formattedSchedules,
      };

      await createParkingSpot(data);
      setMessage({ type: 'success', text: `Spot created from template: ${template.name}` });
      await loadSpots();
    } catch (error) {
      console.error('Failed to create spot from template:', error);
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to create parking spot' });
    }
  };

  const handleCreateSpot = async (e) => {
    e.preventDefault();
    
    try {
      if (editingSpot) {
        // Update existing spot
        const data = {
          latitude: editingSpot.latitude, // Keep original location
          longitude: editingSpot.longitude,
          street_name: formData.street_name,
          address: formData.address,
          spot_type: formData.spot_type,
          duration_estimate: formData.duration_estimate ? parseInt(formData.duration_estimate) : null,
          notes: formData.notes,
          status: formData.status,
        };

        await updateParkingSpot(editingSpot.id, data);
        setMessage({ type: 'success', text: 'Parking spot updated successfully' });
      } else {
        // Create new spot
        const data = {
          latitude: newSpotLocation.lat,
          longitude: newSpotLocation.lng,
          street_name: formData.street_name,
          address: formData.address,
          spot_type: formData.spot_type,
          duration_estimate: formData.duration_estimate ? parseInt(formData.duration_estimate) : null,
          notes: formData.notes,
          status: formData.status,
        };

        await createParkingSpot(data);
        setMessage({ type: 'success', text: 'Parking spot created successfully' });
      }
      
      setShowSpotModal(false);
      setNewSpotLocation(null);
      setEditingSpot(null);
      await loadSpots();
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || `Failed to ${editingSpot ? 'update' : 'create'} parking spot` });
    }
  };

  const handleDeleteSpot = async (spot) => {
    if (!confirm(`Delete parking spot at ${spot.street_name}?`)) return;

    try {
      await deleteParkingSpot(spot.id);
      setMessage({ type: 'success', text: 'Parking spot deleted successfully' });
      if (selectedSpot?.id === spot.id) {
        setSelectedSpot(null);
      }
      await loadSpots();
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to delete parking spot' });
    }
  };

  const handlePolygonCreated = async (coordinates) => {
    if (!selectedSpot) {
      setMessage({ type: 'error', text: 'Please select a parking spot first' });
      return;
    }

    try {
      const closedCoordinates = [...coordinates, coordinates[0]];
      
      // Add polygon to local state for multiple spaces
      const newSpace = {
        id: Date.now(), // temporary ID
        coordinates: closedCoordinates,
        spotId: selectedSpot.id,
      };
      setParkingSpaces(prev => [...prev, newSpace]);
      
      // Save to backend - only include spaces for THIS spot
      const spacesForThisSpot = parkingSpaces.filter(s => s.spotId === selectedSpot.id);
      const allSpacesForThisSpot = [...spacesForThisSpot, newSpace].map(s => s.coordinates);
      
      if (selectedSpot.geofence) {
        await updateGeofence(selectedSpot.id, allSpacesForThisSpot);
        setMessage({ type: 'success', text: `Parking space ${spacesForThisSpot.length + 1} added` });
      } else {
        await createGeofence(selectedSpot.id, allSpacesForThisSpot);
        setMessage({ type: 'success', text: 'First parking space added' });
      }
      
      await loadSpots();
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to save parking space' });
    }
  };

  const handleDeleteGeofence = async (spotId) => {
    if (!confirm('Are you sure you want to delete all parking spaces for this spot?')) return;

    try {
      await deleteGeofence(spotId);
      setParkingSpaces(prev => prev.filter(space => space.spotId !== spotId));
      setMessage({ type: 'success', text: 'All parking spaces deleted' });
      await loadSpots();
      if (selectedSpot?.id === spotId) {
        setSelectedSpot(null);
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to delete parking spaces' });
    }
  };

  const loadAllGeofences = () => {
    const allSpaces = [];
    spots.forEach(spot => {
      if (spot.geofence) {
        try {
          // Parse geofence if it's a string (new format from backend)
          const geofenceData = typeof spot.geofence === 'string' 
            ? JSON.parse(spot.geofence) 
            : spot.geofence;
          
          // Extract coordinates from GeoJSON
          let coordinates;
          if (geofenceData.type === 'Polygon') {
            coordinates = geofenceData.coordinates;
          } else if (geofenceData.coordinates) {
            coordinates = geofenceData.coordinates;
          } else if (Array.isArray(geofenceData)) {
            coordinates = geofenceData;
          }
          
          if (coordinates && coordinates.length > 0) {
            // Add each polygon ring as a space
            if (Array.isArray(coordinates[0][0])) {
              coordinates.forEach((coords, idx) => {
                allSpaces.push({
                  id: `${spot.id}-${idx}`,
                  coordinates: coords,
                  spotId: spot.id,
                });
              });
            } else {
              allSpaces.push({
                id: `${spot.id}-0`,
                coordinates: coordinates[0] || coordinates,
                spotId: spot.id,
              });
            }
          }
        } catch (e) {
          console.error('[MapManager] Failed to parse geofence for spot:', spot.id, e);
        }
      }
    });
    setParkingSpaces(allSpaces);
  };

  const handleSelectSpot = (spot) => {
    setSelectedSpot(spot);
    // Keep all geofences visible, don't filter them
    // The map will still show all parking spaces
  };

  const handleEditSpot = (spot) => {
    setEditingSpot(spot);
    setFormData({
      street_name: spot.street_name || '',
      address: spot.address || '',
      spot_type: spot.spot_type || 'street',
      duration_estimate: spot.duration_estimate || '',
      notes: spot.notes || '',
      status: spot.status || 'available',
    });
    setShowSpotModal(true);
  };

  const center = [45.4215, -75.6972]; // University of Ottawa

  if (loading) {
    return <div className="text-center py-12">Loading map...</div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Map Manager</h1>

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
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Parking Spots</h2>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setRapidFireMode(!rapidFireMode);
                  if (!rapidFireMode) {
                    setIsAddingMode(true);
                  } else {
                    setIsAddingMode(false);
                  }
                }}
                className={`p-2 rounded-lg transition-colors ${
                  rapidFireMode
                    ? 'bg-orange-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                title="Rapid-fire mode"
                disabled={!selectedTemplate}
              >
                <BoltIcon className="w-5 h-5" />
              </button>
              <button
                onClick={() => setIsAddingMode(!isAddingMode)}
                className={`p-2 rounded-lg transition-colors ${
                  isAddingMode && !rapidFireMode
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                title="Click map to add spot"
              >
                <PlusIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Template Selector */}
          {templates.length > 0 && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Template (for rapid-fire)
              </label>
              <select
                value={selectedTemplate?.id || ''}
                onChange={(e) => {
                  const template = templates.find(t => t.id === parseInt(e.target.value));
                  setSelectedTemplate(template || null);
                }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">None (manual mode)</option>
                {templates.map(template => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {rapidFireMode && selectedTemplate && (
            <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <BoltIcon className="w-5 h-5 text-orange-600" />
                <span className="text-sm font-semibold text-orange-900">Rapid-Fire Mode Active</span>
              </div>
              <p className="text-xs text-orange-700">
                Click on the map to quickly create spots using <strong>{selectedTemplate.name}</strong> template
              </p>
            </div>
          )}

          {isAddingMode && !rapidFireMode && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
              Click anywhere on the map to add a new parking spot
            </div>
          )}

          <div className="space-y-2">
            {(() => {
              // Group spots by street name
              const groupedSpots = spots.reduce((acc, spot) => {
                const street = spot.street_name || 'Unknown Street';
                if (!acc[street]) acc[street] = [];
                acc[street].push(spot);
                return acc;
              }, {});

              // Sort streets alphabetically
              const sortedStreets = Object.keys(groupedSpots).sort();

              // Sort spots within each street by street number
              const extractNumber = (address) => {
                if (!address) return 0;
                const match = address.match(/^\d+/);
                return match ? parseInt(match[0]) : 0;
              };

              return sortedStreets.map(street => {
                const spotsInStreet = groupedSpots[street].sort((a, b) => {
                  const numA = extractNumber(a.address);
                  const numB = extractNumber(b.address);
                  return numA - numB;
                });

                const isOpen = openStreets[street] ?? true; // Default open
                const spotCount = spotsInStreet.length;

                return (
                  <div key={street} className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* Street Header */}
                    <button
                      onClick={() => setOpenStreets(prev => ({ ...prev, [street]: !isOpen }))}
                      className="w-full px-3 py-2 bg-gray-100 hover:bg-gray-200 transition-colors flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <ChevronDownIcon 
                          className={`w-4 h-4 transition-transform ${isOpen ? 'transform rotate-0' : 'transform -rotate-90'}`}
                        />
                        <span className="font-semibold text-sm text-gray-900">{street}</span>
                        <span className="text-xs text-gray-500">({spotCount})</span>
                      </div>
                    </button>

                    {/* Spots in Street */}
                    {isOpen && (
                      <div className="divide-y divide-gray-100">
                        {spotsInStreet.map(spot => (
                          <div
                            key={spot.id}
                            onClick={() => handleSelectSpot(spot)}
                            className={`p-3 cursor-pointer transition-colors ${
                              selectedSpot?.id === spot.id
                                ? 'bg-blue-50 border-l-4 border-blue-500'
                                : 'hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="font-medium text-gray-900 text-sm">
                                  {spot.address || spot.street_name || 'Unknown Location'}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  {spot.geofence ? (
                                    <span className="text-green-600">
                                      ✓ {parkingSpaces.filter(s => s.spotId === spot.id).length || 1} space(s)
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">No spaces drawn</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditSpot(spot);
                                  }}
                                  className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                  title="Edit"
                                >
                                  <PencilIcon className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteSpot(spot);
                                  }}
                                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                                  title="Delete"
                                >
                                  <TrashIcon className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* Map */}
        <div className="lg:col-span-3 bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 bg-gray-50 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {selectedSpot ? selectedSpot.street_name : 'Select a parking spot or click map to add'}
                  </h2>
                  {selectedSpot && (
                    <button
                      onClick={() => {
                        setSelectedSpot(null);
                        loadAllGeofences();
                      }}
                      className="px-3 py-1 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
                      title="View all spots"
                    >
                      ← View All
                    </button>
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedSpot 
                    ? `Draw rectangles for each individual parking space (${parkingSpaces.filter(s => s.spotId === selectedSpot.id).length} drawn)` 
                    : isAddingMode
                    ? 'Click on the map to place a new parking spot'
                    : 'Click a spot from the list to draw parking spaces'}
                </p>
              </div>
              {selectedSpot?.geofence && parkingSpaces.filter(s => s.spotId === selectedSpot.id).length > 0 && (
                <button
                  onClick={() => handleDeleteGeofence(selectedSpot.id)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                >
                  Delete All Spaces
                </button>
              )}
            </div>
          </div>

          <div className="h-[calc(100vh-16rem)]">
            <MapContainer
              center={center}
              zoom={13}
              maxZoom={22}
              style={{ height: '100%', width: '100%' }}
            >
              {/* MapTiler Satellite with labels - supports zoom up to 22 */}
              <TileLayer
                attribution='&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url={`https://api.maptiler.com/maps/hybrid/256/{z}/{x}/{y}.jpg?key=${import.meta.env.VITE_MAPTILER_API_KEY || 'get_free_key_at_maptiler_com'}`}
                maxZoom={22}
              />

              <MapClickHandler 
                onMapClick={handleMapClick} 
                isAddingMode={isAddingMode}
                rapidFireMode={rapidFireMode}
              />
              <DrawControl 
                onPolygonCreated={handlePolygonCreated}
                selectedSpot={selectedSpot}
              />

              {/* Temporary marker for new spot */}
              {newSpotLocation && (
                <Marker position={[newSpotLocation.lat, newSpotLocation.lng]}>
                  <Popup>New Spot Location</Popup>
                </Marker>
              )}

              {/* Display parking spots as markers */}
              {spots?.map((spot) => (
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
                      <div className="text-gray-600">{spot.status}</div>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* Display parking spaces as individual polygons */}
              {parkingSpaces.map((space, idx) => {
                const positions = space.coordinates.map(coord => [coord[1], coord[0]]);
                const isSelected = selectedSpot?.id === space.spotId;
                return (
                  <Polygon
                    key={space.id}
                    positions={positions}
                    pathOptions={{
                      color: isSelected ? '#3b82f6' : '#10b981',
                      fillColor: isSelected ? '#93c5fd' : '#86efac',
                      fillOpacity: 0.3,
                      weight: 2,
                    }}
                  >
                    <Popup>
                      <div className="text-sm">
                        <div className="font-semibold">Space {idx + 1}</div>
                        <div className="text-gray-600">
                          {spots.find(s => s.id === space.spotId)?.street_name}
                        </div>
                      </div>
                    </Popup>
                  </Polygon>
                );
              })}
            </MapContainer>
          </div>
        </div>
      </div>

      {/* Modal for new spot details */}
      {showSpotModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">
                {editingSpot ? 'Edit Parking Spot' : 'Add Parking Spot'}
              </h2>
              <button
                onClick={() => {
                  setShowSpotModal(false);
                  setNewSpotLocation(null);
                  setEditingSpot(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleCreateSpot} className="p-6 space-y-4">
              {!editingSpot && newSpotLocation && (
                <div className="text-sm text-gray-600 mb-4">
                  Location: {newSpotLocation?.lat.toFixed(6)}, {newSpotLocation?.lng.toFixed(6)}
                </div>
              )}

              {editingSpot && (
                <div className="text-sm text-gray-600 mb-4 bg-gray-50 p-3 rounded-lg">
                  <div className="font-medium text-gray-700 mb-1">Current Location:</div>
                  <div>{editingSpot.latitude?.toFixed(6)}, {editingSpot.longitude?.toFixed(6)}</div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Street Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.street_name}
                  onChange={(e) => setFormData({ ...formData, street_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Market Street"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Address
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="123 Market St, San Francisco, CA"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Spot Type
                  </label>
                  <select
                    value={formData.spot_type}
                    onChange={(e) => setFormData({ ...formData, spot_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="street">Street</option>
                    <option value="garage">Garage</option>
                    <option value="lot">Lot</option>
                    <option value="private">Private</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="available">Available</option>
                    <option value="occupied">Occupied</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Duration (minutes)
                </label>
                <input
                  type="number"
                  value={formData.duration_estimate}
                  onChange={(e) => setFormData({ ...formData, duration_estimate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="120"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows="2"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Additional information..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  {editingSpot ? 'Update Spot' : 'Create Spot'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowSpotModal(false);
                    setNewSpotLocation(null);
                    setEditingSpot(null);
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
