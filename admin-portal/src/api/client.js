import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  console.log('[API] Request:', config.method?.toUpperCase(), config.url, {
    data: config.data,
    headers: config.headers
  });
  return config;
});

// Add response interceptor for logging
api.interceptors.response.use(
  (response) => {
    console.log('[API] Response:', response.config.method?.toUpperCase(), response.config.url, {
      status: response.status,
      data: response.data
    });
    return response;
  },
  (error) => {
    console.error('[API] Error:', error.config?.method?.toUpperCase(), error.config?.url, {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    return Promise.reject(error);
  }
);

// Auth
export const login = (email, password) => api.post('/auth/login', { email, password });
export const getProfile = () => api.get('/profile');

// Users
export const getUsers = () => api.get('/admin/users');
export const getUserById = (id) => api.get(`/admin/users/${id}`);
export const getUserStats = () => api.get('/admin/stats/users');

// Parking Spots
export const getParkingSpots = () => api.get('/admin/parking-spots');
export const createParkingSpot = (data) => api.post('/admin/parking-spots', data);
export const updateParkingSpot = (id, data) => api.put(`/admin/parking-spots/${id}`, data);
export const deleteParkingSpot = (id) => api.delete(`/admin/parking-spots/${id}`);

// Geofencing
export const createGeofence = (parkingSpotId, polygon) => 
  api.post(`/admin/parking-spots/${parkingSpotId}/geofence`, { polygon });
export const updateGeofence = (parkingSpotId, polygon) => 
  api.put(`/admin/parking-spots/${parkingSpotId}/geofence`, { polygon });
export const deleteGeofence = (parkingSpotId) => 
  api.delete(`/admin/parking-spots/${parkingSpotId}/geofence`);

// Parking Spot Templates
export const getTemplates = () => api.get('/admin/templates');
export const getTemplateById = (id) => api.get(`/admin/templates/${id}`);
export const createTemplate = (data) => api.post('/admin/templates', data);
export const updateTemplate = (id, data) => api.put(`/admin/templates/${id}`, data);
export const deleteTemplate = (id) => api.delete(`/admin/templates/${id}`);

// Enforcement Alerts
export const getEnforcementAlerts = () => api.get('/admin/enforcement-alerts');

// Statistics
export const getOverallStats = () => api.get('/admin/stats/overview');
export const getReportStats = () => api.get('/admin/stats/reports');
export const getTicketStats = () => api.get('/admin/stats/tickets');

export default api;
