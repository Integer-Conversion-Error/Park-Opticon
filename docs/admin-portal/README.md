# Park Opticon Admin Portal

Web-based administrative interface for managing the Park Opticon parking app.

## Features

- **Dashboard**: Overview of system statistics (users, parking spots, alerts, reports)
- **User Management**: View all registered users with their karma points and activity
- **Parking Spots**: Manage all reported parking spots in the system
- **Geofencing**: Define polygon boundaries for parking spots using an interactive map
- **Analytics**: View usage statistics and trends (coming soon)

## Tech Stack

- **React 18** with **Vite** for fast development
- **React Router** for navigation
- **Tailwind CSS** for styling
- **Leaflet** with **Leaflet Draw** for interactive maps and polygon drawing
- **Heroicons** for UI icons
- **Axios** for API communication
- **date-fns** for date formatting

## Getting Started

### Prerequisites

- Node.js 20+ and npm
- Backend server running (Go backend with mock mode or full database)

### Installation

```bash
cd admin-portal
npm install
```

### Configuration

Create a `.env` file (already exists) with:

```
VITE_API_URL=http://100.81.234.39:8080/api/v1
```

Adjust the URL to match your backend server address.

### Development

Start the development server:

```bash
npm run dev
```

The portal will be available at `http://localhost:5173`

### Build for Production

```bash
npm run build
```

The production-ready files will be in the `dist/` directory.

## Usage

### Login

Use the mock credentials to log in:
- Email: `john@example.com`
- Password: `password123`

### Geofencing

1. Navigate to the **Geofencing** page
2. Select a parking spot from the list
3. Use the polygon tool (top-right of the map) to draw a boundary around the parking area
4. Click to place points, double-click to complete the polygon
5. The geofence will be saved automatically

### Backend API

The admin portal connects to the Go backend API. Ensure the backend is running:

```bash
# Run with mock data (no database required)
cd ../backend
./start.sh mock

# Or run with full database
./start.sh full
```

## Project Structure

```
admin-portal/
├── src/
│   ├── api/          # API client with axios
│   ├── components/   # Reusable React components (Layout, etc.)
│   ├── pages/        # Route pages (Dashboard, Users, Geofencing, etc.)
│   ├── App.jsx       # Main app with routing
│   └── main.jsx      # Entry point
├── .env              # Environment variables
├── tailwind.config.js
└── vite.config.js
```

## API Endpoints Used

- `POST /api/v1/auth/login` - Admin authentication
- `GET /api/v1/admin/users` - List all users
- `GET /api/v1/admin/parking-spots` - List parking spots
- `POST /api/v1/admin/parking-spots/:id/geofence` - Create geofence
- `PUT /api/v1/admin/parking-spots/:id/geofence` - Update geofence
- `DELETE /api/v1/admin/parking-spots/:id/geofence` - Delete geofence
- `GET /api/v1/admin/enforcement-alerts` - List alerts
- `GET /api/v1/admin/stats/*` - Statistics endpoints

## Notes

- The backend needs admin-specific endpoints for geofencing CRUD operations
- Geofences are stored as PostGIS polygons in the database
- In mock mode, geofencing operations will need mock handlers
- The map defaults to San Francisco (37.7749, -122.4194) where the mock data is located

## Next Steps

1. Implement backend admin API endpoints for geofencing
2. Add authentication middleware for admin routes
3. Implement analytics dashboard with charts
4. Add bulk operations for user management
5. Add export functionality for reports
