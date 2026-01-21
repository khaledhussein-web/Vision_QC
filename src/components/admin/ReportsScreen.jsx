export default function ReportsScreen({ navigate }) {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-2xl font-bold">Reports Screen</h1>
      <button onClick={() => navigate('admin-dashboard')} className="bg-green-600 text-white py-2 px-4 rounded">
        Back
      </button>
    </div>
  );
}