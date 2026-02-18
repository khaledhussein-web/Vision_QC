import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { generateAdminReport, getAdminReports } from '../../utils/api';

const formatDate = (value) => {
  if (!value) return '--';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '--' : date.toLocaleString();
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

export default function ReportsScreen({ navigate }) {
  const [reportType, setReportType] = useState('images');
  const [reportFormat, setReportFormat] = useState('csv');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');
  const [generateSuccess, setGenerateSuccess] = useState('');
  const [state, setState] = useState({
    loading: false,
    error: '',
    data: [],
    page: 1,
    totalPages: 1
  });

  useEffect(() => {
    let isMounted = true;

    const loadReports = async () => {
      setState((prev) => ({ ...prev, loading: true, error: '' }));
      try {
        const response = await getAdminReports(state.page, 12);
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
          error: error?.error || 'Unable to load reports.'
        }));
      }
    };

    loadReports();

    return () => {
      isMounted = false;
    };
  }, [state.page]);

  const reloadReports = async (page = state.page) => {
    setState((prev) => ({ ...prev, loading: true, error: '' }));
    const response = await getAdminReports(page, 12);
    setState((prev) => ({
      ...prev,
      loading: false,
      data: response.data || [],
      totalPages: response.total_pages || 1
    }));
  };

  const handleGenerateReport = async () => {
    setGenerateError('');
    setGenerateSuccess('');
    setIsGenerating(true);

    try {
      await generateAdminReport(reportType, reportFormat);
      await reloadReports(1);
      setState((prev) => ({ ...prev, page: 1 }));
      setGenerateSuccess(`Generated ${reportType} report in ${reportFormat.toUpperCase()} format.`);
    } catch (error) {
      setGenerateError(error?.error || 'Unable to generate report.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
            <p className="text-sm text-gray-500">Track generated operator reports.</p>
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
          <h2 className="text-lg font-semibold text-gray-900">Generate Report</h2>
          <p className="text-sm text-gray-500">Create a fresh report file and save it to the reports list.</p>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Type</label>
              <select
                value={reportType}
                onChange={(event) => setReportType(event.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="images">Images</option>
                <option value="users">Users</option>
                <option value="predictions">Predictions</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Format</label>
              <select
                value={reportFormat}
                onChange={(event) => setReportFormat(event.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="csv">CSV</option>
                <option value="json">JSON</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={handleGenerateReport}
                disabled={isGenerating}
                className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 disabled:opacity-60"
              >
                {isGenerating ? 'Generating...' : 'Generate Report'}
              </button>
            </div>
          </div>

          {generateError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
              {generateError}
            </div>
          )}

          {generateSuccess && (
            <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-3 text-sm">
              {generateSuccess}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          {state.loading && (
            <div className="flex items-center justify-center text-gray-600">
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Loading reports...
            </div>
          )}

          {!state.loading && state.error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">
              {state.error}
            </div>
          )}

          {!state.loading && !state.error && state.data.length === 0 && (
            <EmptyState message="No reports available." />
          )}

          {!state.loading && !state.error && state.data.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-gray-500 border-b">
                  <tr>
                    <th className="py-2 pr-4">Report</th>
                    <th className="py-2 pr-4">Operator</th>
                    <th className="py-2 pr-4">Format</th>
                    <th className="py-2 pr-4">Created</th>
                    <th className="py-2">Download</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700">
                  {state.data.map((report) => (
                    <tr key={report.report_id} className="border-b last:border-0">
                      <td className="py-3 pr-4">
                        <div className="font-medium text-gray-900">{report.report_type}</div>
                        <div className="text-xs text-gray-500">#{report.report_id}</div>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="text-gray-900">{report.operator_name}</div>
                        <div className="text-xs text-gray-500">{report.operator_email}</div>
                      </td>
                      <td className="py-3 pr-4 uppercase">{report.format}</td>
                      <td className="py-3 pr-4">{formatDate(report.created_at)}</td>
                      <td className="py-3">
                        {report.download_link ? (
                          <a
                            href={report.download_link}
                            className="text-green-600 hover:text-green-700"
                            target="_blank"
                            rel="noreferrer"
                          >
                            Download
                          </a>
                        ) : (
                          <span className="text-gray-400">--</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
