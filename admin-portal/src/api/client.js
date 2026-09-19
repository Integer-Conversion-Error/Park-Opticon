import axios from 'axios';

const configuredURL = import.meta.env.VITE_API_URL;
const API_BASE_URL = configuredURL || (import.meta.env.DEV ? 'http://localhost:8080/api/v1' : '');
let accessToken = null;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
	if (!API_BASE_URL) return Promise.reject(new Error('VITE_API_URL must be configured for production builds.'));
	return config;
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Add response interceptor for logging
api.interceptors.response.use(
  (response) => response,
  (error) => {
	if (error.response?.status === 401) {
		accessToken = null;
		window.dispatchEvent(new Event('parkopticon:auth-expired'));
	}
    return Promise.reject(error);
  }
);

export const setAccessToken = (token) => { accessToken = token || null; };
export const clearAccessToken = () => { accessToken = null; };
export const hasAccessToken = () => Boolean(accessToken);

// Auth
export const login = (email, password) => api.post('/auth/login', { email, password });
export const getProfile = () => api.get('/profile');
export const getMFAStatus = () => api.get('/auth/mfa/status');
export const enrollMFA = () => api.post('/auth/mfa/enroll');
export const confirmMFA = (code) => api.post('/auth/mfa/confirm', { code });
export const verifyMFA = (code) => api.post('/auth/mfa/verify', { code });

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
