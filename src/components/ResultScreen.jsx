export default function ResultScreen({ navigate, selectedImage, currentPrediction }) {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-2xl font-bold">Result Screen</h1>
      <p>Image: {selectedImage}</p>
      <p>Prediction: {currentPrediction?.label}</p>
      <button onClick={() => navigate('home')} className="bg-green-600 text-white py-2 px-4 rounded">
        Back to Home
      </button>
    </div>
  );
}