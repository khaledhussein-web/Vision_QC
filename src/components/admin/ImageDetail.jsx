export default function ImageDetail({ navigate, imageId }) {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-2xl font-bold">Image Detail {imageId}</h1>
      <button onClick={() => navigate('admin-images')} className="bg-green-600 text-white py-2 px-4 rounded">
        Back
      </button>
    </div>
  );
}