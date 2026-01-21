export default function AdminDashboard({ navigate }) {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>
      <button onClick={() => navigate('home')} className="bg-green-600 text-white py-2 px-4 rounded">
        Back to Home
      </button>
    </div>
  );
}