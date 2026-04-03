import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  XCircle
} from 'lucide-react';
import { getRetrainingQueue, updateRetrainingQueueItem } from '../../utils/api';

const statusLabel = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected'
};

export default function RetrainingQueueScreen({ embedded = false }) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('PENDING');
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [actionNotes, setActionNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);

  const PER_PAGE = 10;

  useEffect(() => {
    fetchQueue();
  }, [page, status]);

  useEffect(() => {
    setSelectedItem(null);
    setActionNotes('');
  }, [status, page]);

  const fetchQueue = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getRetrainingQueue(page, PER_PAGE, status);
      setItems(result.items || []);
      setTotal(Number(result.total || 0));
      setPages(Number(result.pages || 0));
    } catch (err) {
      setError(err.detail || err.error || 'Failed to fetch retraining queue');
    } finally {
      setLoading(false);
    }
  };

  const submitStatus = async (nextStatus) => {
    if (!selectedItem) return;
    setIsProcessing(true);
    setError(null);

    try {
      await updateRetrainingQueueItem(
        selectedItem.queue_id,
        nextStatus,
        null,
        actionNotes || null
      );

      setSuccessMessage(
        nextStatus === 'APPROVED'
          ? 'Prediction approved for retraining.'
          : 'Prediction rejected.'
      );

      setSelectedItem(null);
      setActionNotes('');

      setTimeout(() => {
        fetchQueue();
        setSuccessMessage(null);
      }, 900);
    } catch (err) {
      setError(err.detail || err.error || 'Failed to update request');
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (itemStatus) => {
    const normalized = String(itemStatus || '').toUpperCase();

    if (normalized === 'PENDING') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-700">
          <Clock className="h-3.5 w-3.5" />
          Pending
        </span>
      );
    }

    if (normalized === 'APPROVED') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Approved
        </span>
      );
    }

    if (normalized === 'REJECTED') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
          <XCircle className="h-3.5 w-3.5" />
          Rejected
        </span>
      );
    }

    return <span className="text-xs text-gray-500">{normalized || 'Unknown'}</span>;
  };

  const confidenceClass = (confidence) => {
    const percent = Math.round(Number(confidence || 0) * 100);
    if (percent >= 85) return 'bg-green-100 text-green-800';
    if (percent >= 70) return 'bg-orange-100 text-orange-700';
    return 'bg-red-100 text-red-700';
  };

  const Wrapper = embedded ? 'p-4' : 'min-h-screen bg-gradient-to-br from-green-50 to-white';
  const Content = embedded ? '' : 'mx-auto max-w-7xl px-6 py-6';

  return (
    <div className={Wrapper}>
      {!embedded && (
        <header className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-6 text-white shadow-sm">
          <h1 className="text-3xl font-semibold">Retraining Queue</h1>
          <p className="mt-1 text-white/90">
            Review low-confidence predictions and decide what should enter the next model retraining cycle.
          </p>
        </header>
      )}

      <div className={Content}>
        <section className="mb-4 grid gap-3 sm:grid-cols-3">
          {['PENDING', 'APPROVED', 'REJECTED'].map((value) => {
            const isActive = status === value;

            return (
              <button
                key={value}
                onClick={() => {
                  setStatus(value);
                  setPage(1);
                }}
                className={`rounded-2xl border px-4 py-3 text-left transition ${
                  isActive
                    ? 'border-green-600 bg-green-600 text-white'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                  <div className="text-xs uppercase tracking-wide opacity-80">Status</div>
                <div className="mt-1 text-sm font-semibold">{statusLabel[value]}</div>
                {value === 'PENDING' ? (
                  <div className="mt-2 inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                    {total}
                  </div>
                ) : null}
              </button>
            );
          })}
        </section>

        {successMessage ? (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            <CheckCircle2 className="h-4 w-4" />
            {successMessage}
          </div>
        ) : null}

        {error ? (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center">
            <Loader2 className="mx-auto h-7 w-7 animate-spin text-green-600" />
            <p className="mt-3 text-sm text-gray-500">Loading queue...</p>
          </div>
        ) : null}

        {!loading && items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center text-gray-500">
            No {String(status).toLowerCase()} items in the retraining queue.
          </div>
        ) : null}

        {!loading && items.length > 0 ? (
          <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            <section className="space-y-3">
              {items.map((item) => {
                const isSelected = selectedItem?.queue_id === item.queue_id;

                return (
                  <article
                    key={item.queue_id}
                    onClick={() => setSelectedItem(item)}
                    className={`cursor-pointer rounded-2xl border p-4 transition ${
                      isSelected
                        ? 'border-green-400 bg-green-50 ring-2 ring-green-200'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-gray-500">Queue #{item.queue_id}</p>
                        <p className="mt-1 text-base font-semibold text-gray-900 capitalize">{item.label}</p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          Flagged by {item.full_name || 'Unknown'} ({item.email || 'No email'})
                        </p>
                      </div>
                      {getStatusBadge(item.status)}
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      <div className="rounded-lg bg-gray-100 px-3 py-2 text-xs text-gray-600">
                        <div className="uppercase tracking-wide text-gray-500">Confidence</div>
                        <div className={`mt-1 inline-block rounded px-2 py-1 font-semibold ${confidenceClass(item.confidence_score)}`}>
                          {Math.round(Number(item.confidence_score || 0) * 100)}%
                        </div>
                      </div>
                      <div className="rounded-lg bg-gray-100 px-3 py-2 text-xs text-gray-600">
                        <div className="uppercase tracking-wide text-gray-500">Prediction</div>
                        <div className="mt-1 font-mono text-gray-800">#{item.prediction_id}</div>
                      </div>
                      <div className="rounded-lg bg-gray-100 px-3 py-2 text-xs text-gray-600">
                        <div className="uppercase tracking-wide text-gray-500">Created</div>
                        <div className="mt-1 text-gray-800">
                          {item.created_at ? new Date(item.created_at).toLocaleDateString() : '-'}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
                      {item.reason || 'No reason provided by user.'}
                    </div>
                  </article>
                );
              })}

              {pages > 1 ? (
                <div className="mt-2 flex items-center justify-center gap-3 pt-2">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:border-green-500 hover:text-green-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </button>
                  <span className="text-sm text-gray-600">
                    Page {page} of {pages}
                  </span>
                  <button
                    onClick={() => setPage(Math.min(pages, page + 1))}
                    disabled={page === pages}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:border-green-500 hover:text-green-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              ) : null}
            </section>

            <aside className="lg:sticky lg:top-4">
              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <h3 className="text-base font-semibold text-gray-900">Review Panel</h3>

                {!selectedItem ? (
                  <p className="mt-3 text-sm text-gray-500">
                    Select a queue item to inspect details and submit a decision.
                  </p>
                ) : (
                  <>
                    {selectedItem.image_path ? (
                      <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-gray-100">
                        <img
                          src={selectedItem.image_path}
                          alt={selectedItem.label}
                          className="h-48 w-full object-cover"
                          onError={(event) => {
                            event.target.style.display = 'none';
                          }}
                        />
                      </div>
                    ) : null}

                    <div className="mt-4 space-y-3 text-sm text-gray-700">
                      <div className="rounded-lg bg-gray-100 px-3 py-2">
                        <div className="text-xs uppercase tracking-wide text-gray-500">Prediction</div>
                        <div className="mt-1 font-semibold capitalize text-gray-900">{selectedItem.label}</div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-gray-100 px-3 py-2">
                          <div className="text-xs uppercase tracking-wide text-gray-500">Prediction ID</div>
                          <div className="mt-1 font-mono text-gray-900">#{selectedItem.prediction_id}</div>
                        </div>
                        <div className="rounded-lg bg-gray-100 px-3 py-2">
                          <div className="text-xs uppercase tracking-wide text-gray-500">Image ID</div>
                          <div className="mt-1 font-mono text-gray-900">#{selectedItem.image_id}</div>
                        </div>
                      </div>

                      <div className="rounded-lg bg-gray-100 px-3 py-2">
                        <div className="text-xs uppercase tracking-wide text-gray-500">Suggested Solution</div>
                        <div className="mt-1 text-gray-800">{selectedItem.suggested_sc || '-'}</div>
                      </div>

                      <div className="rounded-lg bg-gray-100 px-3 py-2">
                        <div className="text-xs uppercase tracking-wide text-gray-500">Upload Time</div>
                        <div className="mt-1 text-gray-800">
                          {selectedItem.uploaded_at ? new Date(selectedItem.uploaded_at).toLocaleString() : '-'}
                        </div>
                      </div>
                    </div>

                    {String(selectedItem.status).toUpperCase() === 'PENDING' ? (
                      <>
                        <div className="mt-4">
                          <label className="mb-2 block text-sm font-medium text-gray-700">
                            Admin Notes (Optional)
                          </label>
                          <textarea
                            value={actionNotes}
                            onChange={(event) => setActionNotes(event.target.value)}
                            placeholder="Write review notes..."
                            className="h-24 w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
                          />
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <button
                            onClick={() => submitStatus('APPROVED')}
                            disabled={isProcessing}
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                            Approve
                          </button>
                          <button
                            onClick={() => submitStatus('REJECTED')}
                            disabled={isProcessing}
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                            Reject
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-700">
                        <div className="font-semibold text-gray-900">Final Status: {statusLabel[selectedItem.status] || selectedItem.status}</div>
                        {selectedItem.reviewed_at ? (
                          <div className="mt-1 text-xs text-gray-500">
                            Reviewed on {new Date(selectedItem.reviewed_at).toLocaleString()}
                          </div>
                        ) : null}
                        {selectedItem.admin_notes ? (
                          <div className="mt-3 rounded-md bg-white px-3 py-2 text-sm text-gray-700">
                            {selectedItem.admin_notes}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </>
                )}
              </div>
            </aside>
          </div>
        ) : null}
      </div>
    </div>
  );
}

