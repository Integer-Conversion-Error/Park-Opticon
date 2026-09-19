import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import ParkingSpots from './pages/ParkingSpots';
import MapManager from './pages/MapManager';
import Templates from './pages/Templates';
import Analytics from './pages/Analytics';
import './index.css';
import { clearAccessToken, setAccessToken } from './api/client';
import AdminMFA from './components/AdminMFA';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminMFA, setAdminMFA] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is authenticated
    const handleExpired = () => setIsAuthenticated(false);
    window.addEventListener('parkopticon:auth-expired', handleExpired);
    setLoading(false);
    return () => window.removeEventListener('parkopticon:auth-expired', handleExpired);
  }, []);

  const handleLogin = (token, user) => {
    setAccessToken(token);
    if (user?.is_admin) {
      setAdminMFA(user.mfa_enabled ? 'verify' : 'enroll');
      setIsAuthenticated(false);
    } else {
      setIsAuthenticated(true);
    }
  };

  const handleLogout = () => {
    clearAccessToken();
    setAdminMFA(null);
    setIsAuthenticated(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    );
  }

  if (adminMFA) {
    return <AdminMFA mode={adminMFA} onComplete={() => { setAdminMFA(null); setIsAuthenticated(true); }} onLogout={handleLogout} />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to="/" replace />
            ) : (
              <Login onLogin={handleLogin} />
            )
          }
        />
        <Route
          path="/"
          element={
            isAuthenticated ? (
              <Layout onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="users" element={<Users />} />
          <Route path="parking-spots" element={<ParkingSpots />} />
          <Route path="map" element={<MapManager />} />
          <Route path="templates" element={<Templates />} />
          <Route path="analytics" element={<Analytics />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
