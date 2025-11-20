export default function Analytics() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Analytics</h1>
      
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-600">
          Analytics dashboard with charts and statistics coming soon...
        </p>
        <div className="mt-4 text-sm text-gray-500">
          <p>Planned features:</p>
          <ul className="list-disc ml-5 mt-2 space-y-1">
            <li>User growth over time</li>
            <li>Parking spot reports by day/week/month</li>
            <li>Enforcement alert frequency</li>
            <li>Most active users</li>
            <li>Popular parking areas (heatmap)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
