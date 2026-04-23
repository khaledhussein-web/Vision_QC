import { useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { deleteAdminImage } from '../../utils/api';

const formatDate = (value) => {
  if (!value) return '--';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '--' : date.toLocaleString();
};

const formatConfidence = (confidence) => {
  if (confidence === null || confidence === undefined) return '--';
  const numeric = Number(confidence);
  if (Number.isNaN(numeric)) return '--';
  return `${Math.round(numeric * 100)}%`;
};

export default function ImageDetail({ navigate, imageId, image }) {
  const hasImage = Boolean(image);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const handleDeleteSample = async () => {
    const targetImageId = Number(image?.image_id || imageId || 0);
    if (!targetImageId || isDeleting) return;

    const confirmed = window.confirm(
      `Delete image #${targetImageId}? This will also remove related prediction and queue records.`
    );
    if (!confirmed) return;

    setDeleteError('');
    setIsDeleting(true);
    try {
      await deleteAdminImage(targetImageId);
      navigate('admin-images');
    } catch (error) {
      setDeleteError(error?.detail || error?.error || 'Failed to delete image sample.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Image Detail</h1>
            <p className="text-sm text-gray-500">
              {imageId ? `Image #${imageId}` : 'Image details'}
            </p>
          </div>
          <button
            onClick={() => navigate('admin-images')}
            className="bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700"
          >
            Back to Images
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {!hasImage && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-gray-600">
            No image data available. Return to the images list and select a record.
          </div>
        )}

        {hasImage && (
          <div className="grid gap-6 md:grid-cols-[1.2fr_1fr]">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
              <div className="aspect-square rounded-xl bg-gray-100 overflow-hidden flex items-center justify-center text-xs text-gray-400">
                {image.image_url ? (
                  <img src={image.image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  'No image'
                )}
              </div>
              <div className="text-sm text-gray-500">
                Uploaded: {formatDate(image.uploaded_at)}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Prediction</h2>
                <p className="text-sm text-gray-500">Model label and confidence.</p>
              </div>
              <div className="space-y-2 text-sm text-gray-700">
                <div>
                  <span className="text-gray-500">Label:</span> {image.label || '--'}
                </div>
                <div>
                  <span className="text-gray-500">Confidence:</span> {formatConfidence(image.confidence)}
                </div>
                <div>
                  <span className="text-gray-500">Predicted:</span> {formatDate(image.predicted_at)}
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">Uploader</h3>
                <div className="text-sm text-gray-700">
                  <div>{image.full_name || '--'}</div>
                  <div className="text-gray-500">{image.email || '--'}</div>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 text-sm text-gray-700">
                <div>
                  <span className="text-gray-500">Image ID:</span> {image.image_id}
                </div>
                <div>
                  <span className="text-gray-500">Prediction ID:</span> {image.prediction_id || '--'}
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100">
                <button
                  onClick={handleDeleteSample}
                  disabled={isDeleting}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  {isDeleting ? 'Deleting Sample...' : 'Delete Wrong Sample'}
                </button>
                <p className="mt-2 text-xs text-gray-500">
                  Deletes this image and its linked prediction records from the dataset.
                </p>
                {deleteError ? (
                  <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {deleteError}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
