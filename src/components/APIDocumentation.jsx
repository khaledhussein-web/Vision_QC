export default function APIDocumentation({ navigate }) {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-2xl font-bold">API Documentation</h1>
      <button onClick={() => navigate('login')} className="bg-green-600 text-white py-2 px-4 rounded">
        Back
      </button>
    </div>
  );
}