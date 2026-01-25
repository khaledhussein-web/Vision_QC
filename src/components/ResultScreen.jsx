import { ArrowLeft, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from './ui/button';
import { ImageWithFallback } from './figma/ImageWithFallback';

export default function ResultScreen({ navigate, selectedImage, currentPrediction }) {
  const prediction = currentPrediction || null;
  const confidencePercent = prediction?.confidence
    ? Math.round(Number(prediction.confidence) * 100)
    : null;

  const renderConfidenceBadge = () => {
    if (confidencePercent === null) return null;
    if (confidencePercent >= 85) {
      return (
        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          High confidence ({confidencePercent}%)
        </span>
      );
    }
    if (confidencePercent >= 70) {
      return (
        <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-amber-700">
          <AlertTriangle className="h-4 w-4" />
          Medium confidence ({confidencePercent}%)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-red-700">
        <AlertTriangle className="h-4 w-4" />
        Low confidence ({confidencePercent}%)
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex flex-col">
      <div className="bg-white border-b border-gray-200 p-4 flex items-center gap-3">
        <button onClick={() => navigate('upload')} className="text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h2 className="text-gray-900">Analysis Result</h2>
      </div>

      <div className="flex-1 p-6 space-y-6">
        <div className="bg-white rounded-2xl p-4 shadow-md">
          <p className="text-gray-600 mb-3">Uploaded Image</p>
          {selectedImage ? (
            <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-gray-100">
              <ImageWithFallback
                src={selectedImage}
                alt="Uploaded plant"
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <p className="text-gray-500">No image available</p>
          )}
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-md space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-gray-500 text-sm">Prediction</p>
              <h3 className="text-2xl text-gray-900 capitalize">
                {prediction?.label || 'No prediction'}
              </h3>
            </div>
            {renderConfidenceBadge()}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-gray-500 text-xs uppercase">Prediction ID</p>
              <p className="text-gray-900 break-all">
                {prediction?.prediction_id || '—'}
              </p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-gray-500 text-xs uppercase">Image ID</p>
              <p className="text-gray-900 break-all">
                {prediction?.image_id || '—'}
              </p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-gray-500 text-xs uppercase">Created At</p>
              <p className="text-gray-900">
                {prediction?.created_at ? new Date(prediction.created_at).toLocaleString() : '—'}
              </p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-gray-500 text-xs uppercase">Updated At</p>
              <p className="text-gray-900">
                {prediction?.updated_at ? new Date(prediction.updated_at).toLocaleString() : '—'}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <p className="text-gray-500 text-xs uppercase">Suggested Solution</p>
            <p className="text-gray-900">
              {prediction?.suggested_sc || 'No suggestion provided'}
            </p>
          </div>

          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <p className="text-gray-500 text-xs uppercase">Heatmap</p>
            {prediction?.heatmap_url ? (
              <a
                href={prediction.heatmap_url}
                target="_blank"
                rel="noreferrer"
                className="text-green-700 hover:text-green-800 underline"
              >
                View heatmap
              </a>
            ) : (
              <p className="text-gray-900">No heatmap available</p>
            )}
          </div>
        </div>

        <Button
          onClick={() => navigate('upload')}
          className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 shadow-lg py-6"
        >
          Analyze Another Image
        </Button>
      </div>
    </div>
  );
}
