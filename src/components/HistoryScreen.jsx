import { useEffect, useState } from 'react';
import { ArrowLeft, History, ImageOff, Loader2, Bookmark } from 'lucide-react';
import { getHistory, toggleBookmark } from '../utils/api';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { Button } from './ui/button';

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
};

const formatLabel = (label) => {
  if (!label) return 'Unknown';
  return label.replace(/_/g, ' ');
};

const formatConfidence = (confidence) => {
  if (confidence === null || confidence === undefined) return '—';
  const numeric = Number(confidence);
  if (Number.isNaN(numeric)) return '—';
  return `${Math.round(numeric * 100)}%`;
};

const isBookmarked = (item) => {
  if (!item) return false;
  const value =
    item.bookmarked ??
    item.is_bookmarked ??
    item.isBookmarked ??
    item.saved ??
    item.is_saved ??
    item.favorite ??
    item.is_favorite ??
    item.isFavorite ??
    item.bookmark ??
    item.bookmark_id;
  return Boolean(value);
};

export default function HistoryScreen({ navigate, userId }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [bookmarkingId, setBookmarkingId] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadHistory = async () => {
      if (!userId) {
        setError('Please sign in to view your history.');
        return;
      }

      setLoading(true);
      setError('');

      try {
        const response = await getHistory(userId, page, 12);
        if (!isMounted) return;
        setHistory(response.data || []);
        setTotalPages(response.total_pages || 1);
      } catch (err) {
        if (!isMounted) return;
        setError(err?.error || 'Unable to load history.');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadHistory();
    return () => {
      isMounted = false;
    };
  }, [userId, page]);

  const handleBookmark = async (predictionId, currentlyBookmarked) => {
    if (!userId || !predictionId) return;
    setBookmarkingId(predictionId);
    setError('');
    try {
      const action = currentlyBookmarked ? 'remove' : 'add';
      await toggleBookmark(predictionId, userId, action);
      setHistory((prev) =>
        prev.map((item) =>
          item.prediction_id === predictionId
            ? { ...item, bookmarked: !currentlyBookmarked }
            : item
        )
      );
    } catch (err) {
      setError(err?.error || 'Unable to update bookmark.');
    } finally {
      setBookmarkingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex flex-col">
      <div className="bg-white border-b border-gray-200 p-4 flex items-center gap-3">
        <button onClick={() => navigate('home')} className="text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2">
          <History className="w-6 h-6 text-green-600" />
          <h2 className="text-gray-900">Prediction History</h2>
        </div>
      </div>

      <div className="flex-1 p-6 space-y-6">
        {loading && (
          <div className="flex items-center justify-center text-gray-600">
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Loading history...
          </div>
        )}

        {!loading && error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">
            {error}
          </div>
        )}

        {!loading && !error && history.length === 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-md text-center">
            <ImageOff className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-gray-900 mb-2">No predictions yet</h3>
            <p className="text-gray-600 mb-4">Upload an image to get your first prediction.</p>
            <Button onClick={() => navigate('upload')} className="bg-green-600 hover:bg-green-700">
              Upload Image
            </Button>
          </div>
        )}

        {!loading && !error && history.length > 0 && (
          <div className="grid gap-4">
            {history.map((item) => (
              <div key={item.prediction_id} className="bg-white rounded-2xl p-4 shadow-md">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="w-full h-48 sm:basis-3/4 sm:h-64 rounded-xl overflow-hidden bg-gray-100">
                    {item.image_url ? (
                      <ImageWithFallback
                        src={item.image_url}
                        alt={`Prediction ${item.prediction_id}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <ImageOff className="w-8 h-8" />
                      </div>
                    )}
                  </div>

                  <div className="w-full sm:basis-1/4 space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <p className="text-xs uppercase text-gray-500">Prediction</p>
                        <p className="text-lg text-gray-900 capitalize">{formatLabel(item.label)}</p>
                      </div>
                      <span className="text-sm text-green-700 bg-green-50 px-3 py-1 rounded-full">
                        {formatConfidence(item.confidence)} confidence
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs uppercase text-gray-500">Prediction ID</p>
                        <p className="text-gray-900 break-all">{item.prediction_id}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase text-gray-500">Image ID</p>
                        <p className="text-gray-900 break-all">{item.image_id}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase text-gray-500">Created</p>
                        <p className="text-gray-900">{formatDate(item.created_at)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase text-gray-500">Uploaded</p>
                        <p className="text-gray-900">{formatDate(item.uploaded_at)}</p>
                      </div>
                    </div>

                    <div className="text-sm">
                      <p className="text-xs uppercase text-gray-500">Suggested Solution</p>
                      <p className="text-gray-900">{item.suggested_sc || 'No suggestion available.'}</p>
                    </div>

                    <div className="pt-2">
                      <Button
                        variant="outline"
                        onClick={() => handleBookmark(item.prediction_id, isBookmarked(item))}
                        disabled={bookmarkingId === item.prediction_id}
                      >
                        <Bookmark className="w-4 h-4 mr-2" />
                        {bookmarkingId === item.prediction_id
                          ? 'Updating...'
                          : isBookmarked(item)
                            ? 'Remove Bookmark'
                            : 'Save to Bookmarks'}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && !error && totalPages > 1 && (
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
              disabled={page === 1}
            >
              السابق
            </Button>
            <span className="text-sm text-gray-600">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={page === totalPages}
            >
              التالي
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
