import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { getAdminImages } from '../../utils/api';

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

const EmptyState = ({ message }) => (
  <div className="border border-dashed border-gray-200 rounded-xl p-6 text-center text-sm text-gray-500">
    {message}
  </div>
);

const Pagination = ({ page, totalPages, onPrev, onNext }) => (
  <div className="flex items-center justify-between pt-4 text-sm text-gray-600">
    <button
      onClick={onPrev}
      disabled={page === 1}
      className="px-3 py-1 rounded border border-gray-200 disabled:opacity-50"
    >
      Previous
    </button>
    <span>
      Page {page} of {totalPages}
    </span>
    <button
      onClick={onNext}
      disabled={page === totalPages}
      className="px-3 py-1 rounded border border-gray-200 disabled:opacity-50"
    >
      Next
    </button>
  </div>
);

export default function ImageManagement({ navigate, onSelectImage }) {
  const [query, setQuery] = useState('');
  const [state, setState] = useState({
    loading: false,
    error: '',
    data: [],
    page: 1,
    totalPages: 1
  });

  useEffect(() => {
    let isMounted = true;

    const loadImages = async () => {
      setState((prev) => ({ ...prev, loading: true, error: '' }));
      try {
        const response = await getAdminImages(state.page, 12);
        if (!isMounted) return;
        setState((prev) => ({
          ...prev,
          loading: false,
          data: response.data || [],
          totalPages: response.total_pages || 1
        }));
      } catch (error) {
        if (!isMounted) return;
        setState((prev) => ({
          ...prev,
          loading: false,
          error: error?.error || 'Unable to load images.'
        }));
      }
    };

    loadImages();

    return () => {
      isMounted = false;
    };
  }, [state.page]);

  const filteredImages = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return state.data;
    return state.data.filter((image) => {
      const label = String(image.label || '').toLowerCase();
      const email = String(image.email || '').toLowerCase();
      const name = String(image.full_name || '').toLowerCase();
      const id = String(image.image_id || '').toLowerCase();
      return (
        label.includes(trimmed) ||
        email.includes(trimmed) ||
        name.includes(trimmed) ||
        id.includes(trimmed)
      );
    });
  }, [query, state.data]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Image Management</h1>
            <p className="text-sm text-gray-500">Review uploads and prediction activity.</p>
          </div>
          <button
            onClick={() => navigate('admin-dashboard')}
            className="bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Uploads</h2>
              <p className="text-sm text-gray-500">Search by label, user, or image ID.</p>
            </div>
            <div className="relative w-full md:max-w-xs">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search images"
                className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          {state.loading && (
            <div className="flex items-center justify-center text-gray-600">
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Loading images...
            </div>
          )}

          {!state.loading && state.error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">
              {state.error}
            </div>
          )}

          {!state.loading && !state.error && filteredImages.length === 0 && (
            <EmptyState message="No images found yet." />
          )}

          {!state.loading && !state.error && filteredImages.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredImages.map((image) => (
                <div
                  key={image.image_id}
                  className="border border-gray-100 rounded-xl p-4 flex gap-4 hover:shadow-sm transition"
                >
                  <div className="w-20 h-20 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center text-xs text-gray-400">
                    {image.image_url ? (
                      <img src={image.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      'No image'
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="text-sm font-semibold text-gray-900">
                      Image #{image.image_id}
                    </div>
                    <div className="text-xs text-gray-500">
                      {image.full_name} ({image.email})
                    </div>
                    <div className="text-xs text-gray-500">
                      Label: {image.label || '--'} | Confidence: {formatConfidence(image.confidence)}
                    </div>
                    <div className="text-xs text-gray-500">
                      Uploaded: {formatDate(image.uploaded_at)}
                    </div>
                  </div>
                  <div className="flex items-start">
                    <button
                      onClick={() => onSelectImage(image)}
                      className="text-sm text-green-600 hover:text-green-700"
                    >
                      View
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!state.loading && !state.error && state.totalPages > 1 && (
            <Pagination
              page={state.page}
              totalPages={state.totalPages}
              onPrev={() => setState((prev) => ({ ...prev, page: Math.max(prev.page - 1, 1) }))}
              onNext={() =>
                setState((prev) => ({ ...prev, page: Math.min(prev.page + 1, prev.totalPages) }))
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
