import { useEffect, useState } from 'react';
import { UsersIcon, MapPinIcon, ExclamationTriangleIcon, TicketIcon } from '@heroicons/react/24/outline';
import { getUsers, getParkingSpots, getEnforcementAlerts } from '../api/client';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalParkingSpots: 0,
    activeAlerts: 0,
    totalReports: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [usersRes, spotsRes, alertsRes] = await Promise.all([
        getUsers(),
        getParkingSpots(),
        getEnforcementAlerts(),
      ]);

      setStats({
        totalUsers: usersRes.data?.length || 0,
        totalParkingSpots: spotsRes.data?.length || 0,
        activeAlerts: alertsRes.data?.filter(a => a.is_active)?.length || 0,
        totalReports: spotsRes.data?.reduce((sum, spot) => sum + (spot.report_count || 0), 0) || 0,
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { name: 'Total Users', value: stats.totalUsers, icon: UsersIcon, color: 'bg-blue-500' },
    { name: 'Parking Spots', value: stats.totalParkingSpots, icon: MapPinIcon, color: 'bg-green-500' },
    { name: 'Active Alerts', value: stats.activeAlerts, icon: ExclamationTriangleIcon, color: 'bg-yellow-500' },
    { name: 'Total Reports', value: stats.totalReports, icon: TicketIcon, color: 'bg-purple-500' },
  ];

  if (loading) {
    return <div className="text-center py-12">Loading dashboard...</div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat) => (
          <div key={stat.name} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
              </div>
              <div className={`${stat.color} p-3 rounded-lg`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Activity</h2>
        <p className="text-gray-600">Activity feed coming soon...</p>
      </div>
    </div>
  );
}
