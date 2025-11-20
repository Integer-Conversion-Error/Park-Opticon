import { useEffect, useState } from 'react';
import { getParkingSpots, createParkingSpot, updateParkingSpot, deleteParkingSpot, createGeofence } from '../api/client';
import { PlusIcon, PencilIcon, TrashIcon, XMarkIcon, MapIcon, TableCellsIcon } from '@heroicons/react/24/outline';
import ParkingSpotMap from '../components/ParkingSpotMap';

export default function ParkingSpots() {
  const [spots, setSpots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSpot, setEditingSpot] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'map'
  const [selectedSpotForGeofence, setSelectedSpotForGeofence] = useState(null); // For drawing geofence
  const [formData, setFormData] = useState({
    latitude: '',
    longitude: '',
    address: '',
    street_name: '',
    spot_type: 'street',
    duration_estimate: '',
    notes: '',
    status: 'available',
  });

  useEffect(() => {
    loadSpots();
  }, []);

  const loadSpots = async () => {
    console.log('[ParkingSpots] Loading parking spots...');
    try {
      const response = await getParkingSpots();
      console.log('[ParkingSpots] API Response:', response);
      console.log('[ParkingSpots] Response data:', response.data);
      console.log('[ParkingSpots] Data type:', typeof response.data, 'Is array:', Array.isArray(response.data));
      setSpots(response.data || []);
      console.log('[ParkingSpots] Spots set successfully, count:', (response.data || []).length);
    } catch (error) {
      console.error('[ParkingSpots] Failed to load parking spots:', error);
      console.error('[ParkingSpots] Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      setMessage({ type: 'error', text: 'Failed to load parking spots' });
      setSpots([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingSpot(null);
    setFormData({
      latitude: '',
      longitude: '',
      address: '',
      street_name: '',
      spot_type: 'street',
      duration_estimate: '',
      notes: '',
      status: 'available',
    });
    setShowModal(true);
  };

  const handleEdit = (spot) => {
    setEditingSpot(spot);
    
    setFormData({
      latitude: spot.latitude || '',
      longitude: spot.longitude || '',
      address: spot.address || '',
      street_name: spot.street_name || '',
      spot_type: spot.spot_type || 'street',
      duration_estimate: spot.duration_estimate || '',
      notes: spot.notes || '',
      status: spot.status || 'available',
    });
    setShowModal(true);
  };

  const handleDelete = async (spot) => {
    if (!confirm(`Delete parking spot at ${spot.street_name}?`)) return;

    try {
      await deleteParkingSpot(spot.id);
      setMessage({ type: 'success', text: 'Parking spot deleted successfully' });
      await loadSpots();
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to delete parking spot' });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    console.log('[ParkingSpots] Form submitted');
    console.log('[ParkingSpots] Form data (raw):', formData);
    
    try {
      // Submit with center point only
      const data = {
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        street_name: formData.street_name || null,
        address: formData.address || null,
        spot_type: formData.spot_type || null,
        duration_estimate: formData.duration_estimate ? parseInt(formData.duration_estimate) : null,
        notes: formData.notes || null,
        status: formData.status,
      };
      
      console.log('[ParkingSpots] Prepared data for API:', data);

      if (editingSpot) {
        console.log('[ParkingSpots] Updating spot:', editingSpot.id);
        const response = await updateParkingSpot(editingSpot.id, data);
        console.log('[ParkingSpots] Update response:', response);
        setMessage({ type: 'success', text: 'Parking spot updated successfully' });
      } else {
        console.log('[ParkingSpots] Creating new spot...');
        const response = await createParkingSpot(data);
        console.log('[ParkingSpots] Create response:', response);
        setMessage({ type: 'success', text: 'Parking spot created successfully' });
      }

      setShowModal(false);
      console.log('[ParkingSpots] Reloading spots after save...');
      await loadSpots();
    } catch (error) {
      console.error('[ParkingSpots] Submit error:', error);
      console.error('[ParkingSpots] Error response:', error.response);
      console.error('[ParkingSpots] Error data:', error.response?.data);
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to save parking spot' });
    }
  };

  const handleGeofenceUpdate = async (coordinates) => {
    if (!selectedSpotForGeofence) {
      setMessage({ type: 'error', text: 'Please select a parking spot first' });
      return;
    }

    console.log('[ParkingSpots] Creating geofence for spot:', selectedSpotForGeofence);
    console.log('[ParkingSpots] Geofence coordinates:', coordinates);

    try {
      // Call API with properly formatted polygon
      await createGeofence(selectedSpotForGeofence, coordinates);
      setMessage({ type: 'success', text: 'Geofence created successfully!' });
      setSelectedSpotForGeofence(null);
      await loadSpots();
    } catch (error) {
      console.error('[ParkingSpots] Geofence error:', error);
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to create geofence' });
    }
  };

  const availabilityColor = (status) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-800';
      case 'occupied': return 'bg-red-100 text-red-800';
      case 'unknown': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading parking spots...</div>;
  }

  return (
    <div>
      {message.text && (
        <div className={`mb-4 p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          {message.text}
        </div>
      )}

      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Parking Spots</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">Total: {spots?.length || 0}</span>
          
          {/* View Toggle */}
          <div className="flex items-center gap-2 border border-gray-300 rounded-lg">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                viewMode === 'list' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <TableCellsIcon className="w-5 h-5" />
              <span className="text-sm font-medium">List</span>
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                viewMode === 'map' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <MapIcon className="w-5 h-5" />
              <span className="text-sm font-medium">Map</span>
            </button>
          </div>
          
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <PlusIcon className="w-5 h-5" />
            Add Spot
          </button>
        </div>
      </div>

      {viewMode === 'map' ? (
        <div className="relative">
          {/* Selection panel */}
          {selectedSpotForGeofence && (
            <div className="absolute top-4 right-4 z-10 bg-white rounded-lg shadow-lg p-4 max-w-xs">
              <h3 className="text-sm font-semibold mb-2 text-gray-900">
                Drawing Geofence
              </h3>
              <p className="text-xs text-gray-600 mb-3">
                Selected: <span className="font-medium">{
                  spots.find(s => s.id === selectedSpotForGeofence)?.street_name || 'Unknown'
                }</span>
              </p>
              <button
                onClick={() => setSelectedSpotForGeofence(null)}
                className="text-xs px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
          
          {/* Spot selector dropdown */}
          <div className="absolute bottom-4 right-4 z-10 bg-white rounded-lg shadow-lg p-4">
            <label className="block text-sm font-semibold mb-2 text-gray-900">
              Select Spot to Add Geofence:
            </label>
            <select
              value={selectedSpotForGeofence || ''}
              onChange={(e) => setSelectedSpotForGeofence(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Choose a parking spot --</option>
              {spots.map(spot => (
                <option key={spot.id} value={spot.id}>
                  {spot.street_name || `Spot at ${spot.latitude?.toFixed(4)}, ${spot.longitude?.toFixed(4)}`}
                </option>
              ))}
            </select>
            {selectedSpotForGeofence && (
              <p className="mt-2 text-xs text-green-600 font-medium">
                ✓ Ready! Use the polygon tool on the left to draw.
              </p>
            )}
          </div>

          <ParkingSpotMap 
            spots={spots} 
            onGeofenceUpdate={handleGeofenceUpdate}
            selectedSpotId={selectedSpotForGeofence}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {spots && spots.map((spot) => (
          <div key={spot.id} className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">{spot.street_name}</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {spot.latitude?.toFixed(6)}, {spot.longitude?.toFixed(6)}
                </p>
              </div>
              <div className="flex gap-2 ml-2">
                <button
                  onClick={() => handleEdit(spot)}
                  className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                  title="Edit"
                >
                  <PencilIcon className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleDelete(spot)}
                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                  title="Delete"
                >
                  <TrashIcon className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="mb-3">
              <span className={`px-3 py-1 text-xs font-semibold rounded-full ${availabilityColor(spot.status)}`}>
                {spot.status}
              </span>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Type:</span>
                <span className="font-medium text-gray-900">{spot.spot_type || 'N/A'}</span>
              </div>
              {spot.duration_estimate && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Duration:</span>
                  <span className="font-medium text-gray-900">{spot.duration_estimate} min</span>
                </div>
              )}
              {spot.notes && (
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <p className="text-xs text-gray-600">{spot.notes}</p>
                </div>
              )}
            </div>

            {spot.geofence && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <span className="text-xs text-green-600 font-medium">✓ Geofenced</span>
              </div>
            )}
          </div>
        ))}
        </div>
      )}

      {/* Modal for Create/Edit */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingSpot ? 'Edit Parking Spot' : 'Create Parking Spot'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Coordinate Inputs */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Latitude *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formData.latitude}
                    onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="45.4215"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Longitude *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formData.longitude}
                    onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="-75.6972"
                  />
                </div>
              </div>
              
              <p className="text-xs text-blue-600 bg-blue-50 p-3 rounded-lg">
                💡 <strong>Tip:</strong> After creating the spot, switch to Map view to draw a precise geofence polygon around it.
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Street Name
                </label>
                <input
                  type="text"
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
                  Duration Estimate (minutes)
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
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Additional information about this parking spot..."
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
                  onClick={() => setShowModal(false)}
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
