# Park Opticon Admin Portal

## Overview

The Park Opticon Admin Portal is a React-based web application that provides administrators with a comprehensive interface to manage the parking app ecosystem. The portal features an interactive map for geofencing parking spots, user management, and real-time statistics.

## Architecture

### Frontend Stack
- **React 18.3.1** - UI framework
- **Vite 7.2.2** - Build tool and dev server
- **React Router 7.1.3** - Client-side routing
- **Tailwind CSS 3.4.17** - Utility-first CSS framework
- **Leaflet 1.9.4** - Interactive maps
- **Leaflet Draw** - Polygon drawing tools
- **Axios 1.7.9** - HTTP client
- **Heroicons 2.3.0** - UI icons
- **date-fns 4.1.0** - Date formatting

### Key Features

#### 1. Dashboard
- Real-time system statistics
- User count, parking spot count, active alerts
- Total report metrics
- Color-coded stat cards with icons

#### 2. User Management
- List all registered users
- View user details (email, phone, karma points)
- Join date and activity tracking
- Avatar placeholders based on user names

#### 3. Parking Spots
- Grid view of all parking spots
- Real-time availability status
- Report counts and confidence scores
- Time limit information
- Geofence status indicator

#### 4. Geofencing (★ Primary Feature)
- Interactive Leaflet map centered on San Francisco
- List of all parking spots with selection
- Polygon drawing tool for defining boundaries
- Visual representation of existing geofences
- CRUD operations for geofence polygons
- Click markers to select spots
- Real-time polygon rendering

#### 5. Analytics
- Placeholder for future analytics dashboard
- Planned: Charts, trends, heatmaps

## Installation & Setup

### Prerequisites
```bash
# Ensure Node.js 20+ is installed
node --version  # Should be v20.x or higher

# Backend should be running
cd ../backend
./start.sh mock  # or ./start.sh full
```

### Install Dependencies
```bash
cd /root/Projects/Park-Opticon/admin-portal
npm install
```

### Environment Configuration
The `.env` file contains:
```
VITE_API_URL=http://100.81.234.39:8080/api/v1
```

Update this URL to match your backend server address (use Tailscale IP for remote access).

### Development Server
```bash
npm run dev
```
Access at: `http://localhost:5173`

### Production Build
```bash
npm run build
npm run preview  # Preview the production build
```

## Project Structure

```
admin-portal/
├── public/              # Static assets
├── src/
│   ├── api/
│   │   └── client.js    # Axios client with interceptors, API functions
│   ├── components/
│   │   └── Layout.jsx   # Main layout with sidebar navigation
│   ├── pages/
│   │   ├── Login.jsx           # Authentication page
│   │   ├── Dashboard.jsx       # Statistics overview
│   │   ├── Users.jsx           # User management table
│   │   ├── ParkingSpots.jsx    # Parking spot grid
│   │   ├── Geofencing.jsx      # Map-based geofencing UI
│   │   └── Analytics.jsx       # Analytics placeholder
│   ├── App.jsx          # Main app with routing and auth
│   ├── main.jsx         # Entry point
│   └── index.css        # Global styles with Tailwind
├── .env                 # Environment variables
├── tailwind.config.js   # Tailwind configuration
├── postcss.config.js    # PostCSS with Tailwind/Autoprefixer
├── vite.config.js       # Vite configuration
├── package.json         # Dependencies
└── README.md            # Documentation
```

## API Integration

### Authentication
The app uses JWT token-based authentication:

```javascript
// Login
POST /api/v1/auth/login
Body: { email, password }
Response: { access_token, refresh_token }

// Token is stored in localStorage as 'admin_token'
// Axios interceptor automatically adds it to requests
```

### API Client (`src/api/client.js`)

All API functions are centralized:

```javascript
// Auth
login(email, password)
getProfile()

// Users
getUsers()
getUserById(id)
getUserStats()

// Parking Spots
getParkingSpots()
createParkingSpot(data)
updateParkingSpot(id, data)
deleteParkingSpot(id)

// Geofencing
createGeofence(parkingSpotId, polygon)
updateGeofence(parkingSpotId, polygon)
deleteGeofence(parkingSpotId)

// Enforcement
getEnforcementAlerts()

// Statistics
getOverallStats()
getReportStats()
getTicketStats()
```

### Mock Credentials
- **Email**: `john@example.com`
- **Password**: `password123`

## Geofencing System

### How It Works

1. **Select Parking Spot**: Click a spot from the list on the left
2. **Draw Polygon**: Use the polygon tool (top-right corner of map)
3. **Place Points**: Click on the map to place polygon vertices
4. **Complete**: Double-click to close the polygon
5. **Save**: Automatically saved to backend

### Technical Details

- **Map Library**: Leaflet with OpenStreetMap tiles
- **Drawing**: Leaflet.Draw plugin
- **Coordinate Format**: GeoJSON polygon format
  ```javascript
  // Frontend sends: [[lng, lat], [lng, lat], ...]
  // Backend stores as PostGIS polygon
  ```
- **Visual Feedback**:
  - Green polygons: Existing geofences
  - Blue polygons: Selected parking spot geofence
  - Red markers: Parking spot locations

### Polygon Data Structure
```javascript
{
  type: "Polygon",
  coordinates: [
    [
      [-122.419416, 37.774929],  // [lng, lat]
      [-122.419400, 37.774850],
      [-122.419300, 37.774870],
      [-122.419320, 37.774950],
      [-122.419416, 37.774929]   // Closes the polygon
    ]
  ]
}
```

## Backend Requirements

### Required Endpoints

The admin portal expects these backend endpoints:

#### Admin Routes (Need to be implemented)
```
GET    /api/v1/admin/users
GET    /api/v1/admin/users/:id
GET    /api/v1/admin/parking-spots
POST   /api/v1/admin/parking-spots/:id/geofence
PUT    /api/v1/admin/parking-spots/:id/geofence
DELETE /api/v1/admin/parking-spots/:id/geofence
GET    /api/v1/admin/enforcement-alerts
GET    /api/v1/admin/stats/overview
GET    /api/v1/admin/stats/users
GET    /api/v1/admin/stats/reports
GET    /api/v1/admin/stats/tickets
```

#### Current Backend Status
- ✅ Mock mode has `/auth/login`, `/parking-spots/nearby`, etc.
- ❌ Admin-specific endpoints not yet implemented
- ❌ Geofencing CRUD operations not yet implemented

### Mock Mode Integration

For development, the backend mock mode needs to be extended:

```go
// backend/internal/mockhandlers/admin_handlers.go
func GetUsers(c *gin.Context) {
    c.JSON(200, mockdata.Users)
}

func GetAllParkingSpots(c *gin.Context) {
    c.JSON(200, mockdata.ParkingSpots)
}

func CreateGeofence(c *gin.Context) {
    // Mock implementation
}
```

## Styling Guide

### Tailwind Classes Used

**Layout**:
- `min-h-screen` - Full viewport height
- `pl-64` - Left padding for fixed sidebar
- `max-h-[calc(100vh-12rem)]` - Dynamic height calculations

**Colors**:
- Blue: Primary actions, selected states
- Green: Success, available status
- Red: Danger, occupied status
- Gray: Neutral, borders, backgrounds
- Yellow: Warnings, pending states

**Components**:
```jsx
// Card
<div className="bg-white rounded-lg shadow p-6">

// Button Primary
<button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">

// Button Danger
<button className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700">

// Badge
<span className="px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">

// Input
<input className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
```

## Development Workflow

### Adding a New Page

1. **Create page component**:
```bash
touch src/pages/NewPage.jsx
```

2. **Add route in `App.jsx`**:
```jsx
import NewPage from './pages/NewPage';

// Inside Layout routes
<Route path="new-page" element={<NewPage />} />
```

3. **Add navigation item in `Layout.jsx`**:
```jsx
{ name: 'New Page', href: '/new-page', icon: YourIcon }
```

### Making API Calls

1. **Add API function in `client.js`**:
```javascript
export const getNewData = () => api.get('/admin/new-data');
```

2. **Use in component**:
```jsx
import { getNewData } from '../api/client';

useEffect(() => {
  const load = async () => {
    const response = await getNewData();
    setData(response.data);
  };
  load();
}, []);
```

## Troubleshooting

### Common Issues

**1. "Failed to fetch" errors**
- Check if backend is running: `./start.sh mock`
- Verify `.env` has correct API URL
- Check CORS settings in backend

**2. Map not rendering**
- Ensure Leaflet CSS is imported in `index.css`
- Check browser console for missing marker icons
- Verify CDN URLs for marker images

**3. Authentication loops**
- Clear localStorage: `localStorage.removeItem('admin_token')`
- Check token format from backend
- Verify interceptor is adding Authorization header

**4. Tailwind styles not applying**
- Run `npm run dev` to rebuild with Vite
- Check `tailwind.config.js` content paths
- Ensure PostCSS is processing the CSS

### Debug Mode

Enable detailed logging:
```javascript
// In api/client.js
api.interceptors.response.use(
  response => {
    console.log('API Response:', response);
    return response;
  },
  error => {
    console.error('API Error:', error.response || error);
    return Promise.reject(error);
  }
);
```

## Performance Optimization

### Current Optimizations
- Vite's hot module replacement (HMR) for fast development
- React lazy loading ready (not yet implemented)
- Axios request interceptors for centralized auth
- Tailwind purges unused CSS in production build

### Future Optimizations
- Code splitting by route
- Lazy load heavy components (map, charts)
- Implement React.memo for expensive renders
- Add service worker for offline support
- Compress map tiles

## Security Considerations

### Current Implementation
- JWT tokens stored in localStorage
- Axios interceptor adds auth header
- Protected routes with React Router
- Input validation on forms

### Production Recommendations
- Use httpOnly cookies instead of localStorage
- Implement refresh token rotation
- Add CSRF protection
- Rate limiting on login endpoint
- Audit logging for admin actions
- Input sanitization on backend
- HTTPS only in production

## Deployment

### Production Build
```bash
npm run build
# Output: dist/ directory
```

### Deployment Options

**1. Static Hosting (Netlify, Vercel)**:
```bash
# netlify.toml
[build]
  command = "npm run build"
  publish = "dist"
```

**2. Docker**:
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
CMD ["npm", "run", "preview"]
```

**3. Nginx**:
```nginx
server {
  listen 80;
  root /var/www/admin-portal/dist;
  
  location / {
    try_files $uri $uri/ /index.html;
  }
  
  location /api {
    proxy_pass http://backend:8080;
  }
}
```

## Testing

### Manual Testing Checklist

- [ ] Login with valid credentials
- [ ] Login with invalid credentials (should show error)
- [ ] Logout clears token and redirects to login
- [ ] Dashboard loads statistics
- [ ] Users page displays all users
- [ ] Parking spots page shows all spots
- [ ] Geofencing map loads with markers
- [ ] Can select parking spot from list
- [ ] Can draw polygon on map
- [ ] Polygon saves and displays
- [ ] Can delete existing geofence
- [ ] Navigation between pages works
- [ ] Page refresh maintains auth state

### Future Testing
- Unit tests with Vitest
- E2E tests with Playwright
- Integration tests for API calls
- Accessibility testing

## Roadmap

### Phase 1 (Current)
- ✅ Basic authentication
- ✅ Dashboard with statistics
- ✅ User management view
- ✅ Parking spots view
- ✅ Geofencing with Leaflet Draw
- ✅ Responsive sidebar navigation

### Phase 2 (Next)
- [ ] Backend admin API endpoints
- [ ] Geofence persistence with PostGIS
- [ ] User detail pages with edit
- [ ] Parking spot CRUD operations
- [ ] Real-time statistics updates

### Phase 3 (Future)
- [ ] Analytics dashboard with Recharts
- [ ] Heatmap of parking activity
- [ ] Export data to CSV/JSON
- [ ] Email notifications
- [ ] Role-based access control
- [ ] Audit log viewer
- [ ] Mobile-responsive design improvements

## Contributing

When making changes:
1. Follow existing code style
2. Use Tailwind utility classes
3. Keep components focused and small
4. Add error handling for API calls
5. Test on multiple browsers
6. Update this documentation

## Contact & Support

For issues related to:
- **Frontend**: Check React DevTools, browser console
- **Backend API**: Check Go server logs
- **Database**: Check PostgreSQL logs
- **Maps**: Check Leaflet documentation

---

**Last Updated**: January 2025  
**Version**: 1.0.0  
**Status**: Development
