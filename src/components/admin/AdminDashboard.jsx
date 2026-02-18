import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { getAdminImages, getAdminReports, getAdminUsers } from '../../utils/api';

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
};

const formatConfidence = (confidence) => {
  if (confidence === null || confidence === undefined) return '—';
  const numeric = Number(confidence);
  if (Number.isNaN(numeric)) return '—';
  return `${Math.round(numeric * 100)}%`;
};

const TableHeader = ({ title, subtitle }) => (
  <div className="flex flex-col gap-1">
    <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
    {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
  </div>
);

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

export default function AdminDashboard({ navigate }) {
  const [activeTab, setActiveTab] = useState('users');

  const [usersState, setUsersState] = useState({
    loading: false,
    error: '',
    data: [],
    page: 1,
    totalPages: 1
  });

  const [imagesState, setImagesState] = useState({
    loading: false,
    error: '',
    data: [],
    page: 1,
    totalPages: 1
  });

  const [reportsState, setReportsState] = useState({
    loading: false,
    error: '',
    data: [],
    page: 1,
    totalPages: 1
  });

  const tabs = useMemo(
    () => [
      { key: 'users', label: 'Users' },
      { key: 'images', label: 'Images' },
      { key: 'reports', label: 'Reports' }
    ],
    []
  );

  useEffect(() => {
    let isMounted = true;

    const loadUsers = async () => {
      setUsersState((prev) => ({ ...prev, loading: true, error: '' }));
      try {
        const response = await getAdminUsers(usersState.page, 10);
        if (!isMounted) return;
        setUsersState((prev) => ({
          ...prev,
          loading: false,
          data: response.data || [],
          totalPages: response.total_pages || 1
        }));
      } catch (error) {
        if (!isMounted) return;
        setUsersState((prev) => ({
          ...prev,
          loading: false,
          error: error?.error || 'Unable to load users.'
        }));
      }
    };

    const loadImages = async () => {
      setImagesState((prev) => ({ ...prev, loading: true, error: '' }));
      try {
        const response = await getAdminImages(imagesState.page, 10);
        if (!isMounted) return;
        setImagesState((prev) => ({
          ...prev,
          loading: false,
          data: response.data || [],
          totalPages: response.total_pages || 1
        }));
      } catch (error) {
        if (!isMounted) return;
        setImagesState((prev) => ({
          ...prev,
          loading: false,
          error: error?.error || 'Unable to load images.'
        }));
      }
    };

    const loadReports = async () => {
      setReportsState((prev) => ({ ...prev, loading: true, error: '' }));
      try {
        const response = await getAdminReports(reportsState.page, 10);
        if (!isMounted) return;
        setReportsState((prev) => ({
          ...prev,
          loading: false,
          data: response.data || [],
          totalPages: response.total_pages || 1
        }));
      } catch (error) {
        if (!isMounted) return;
        setReportsState((prev) => ({
          ...prev,
          loading: false,
          error: error?.error || 'Unable to load reports.'
        }));
      }
    };

    if (activeTab === 'users') {
      loadUsers();
    }

    if (activeTab === 'images') {
      loadImages();
    }

    if (activeTab === 'reports') {
      loadReports();
    }

    return () => {
      isMounted = false;
    };
  }, [activeTab, usersState.page, imagesState.page, reportsState.page]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-sm text-gray-500">Manage users, image activity, and reports.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => navigate('admin-access')}
              className="bg-white text-gray-700 py-2 px-4 rounded border border-gray-200 hover:border-green-500"
            >
              Access Control
            </button>
            <button
              onClick={() => navigate('admin-reports')}
              className="bg-white text-gray-700 py-2 px-4 rounded border border-gray-200 hover:border-green-500"
            >
              Reports
            </button>
            <button
              onClick={() => navigate('admin-dashboard')}
              className="bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <button
            onClick={() => navigate('admin-access')}
            className="bg-white rounded-2xl border border-gray-100 p-5 text-left shadow-sm hover:shadow-md transition"
          >
            <div className="text-sm text-gray-500">Access</div>
            <div className="text-lg font-semibold text-gray-900">Manage Users</div>
            <p className="text-xs text-gray-500 mt-2">Review roles, status, and activity.</p>
          </button>
          <button
            onClick={() => navigate('admin-images')}
            className="bg-white rounded-2xl border border-gray-100 p-5 text-left shadow-sm hover:shadow-md transition"
          >
            <div className="text-sm text-gray-500">Images</div>
            <div className="text-lg font-semibold text-gray-900">Image Management</div>
            <p className="text-xs text-gray-500 mt-2">Review uploads and predictions.</p>
          </button>
          <button
            onClick={() => navigate('admin-reports')}
            className="bg-white rounded-2xl border border-gray-100 p-5 text-left shadow-sm hover:shadow-md transition"
          >
            <div className="text-sm text-gray-500">Reports</div>
            <div className="text-lg font-semibold text-gray-900">Generate Reports</div>
            <p className="text-xs text-gray-500 mt-2">Download operator reports.</p>
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-full text-sm font-medium border transition ${
                activeTab === tab.key
                  ? 'bg-green-600 text-white border-green-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-green-400'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'users' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
            <TableHeader title="Users" subtitle="Active accounts and roles." />

            {usersState.loading && (
              <div className="flex items-center justify-center text-gray-600">
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Loading users...
              </div>
            )}

            {!usersState.loading && usersState.error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">
                {usersState.error}
              </div>
            )}

            {!usersState.loading && !usersState.error && usersState.data.length === 0 && (
              <EmptyState message="No users available yet." />
            )}

            {!usersState.loading && !usersState.error && usersState.data.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-gray-500 border-b">
                    <tr>
                      <th className="py-2 pr-4">User</th>
                      <th className="py-2 pr-4">Email</th>
                      <th className="py-2 pr-4">Role</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Created</th>
                      <th className="py-2">Last Login</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-700">
                    {usersState.data.map((user) => (
                      <tr key={user.user_id} className="border-b last:border-0">
                        <td className="py-3 pr-4 font-medium text-gray-900">{user.full_name}</td>
                        <td className="py-3 pr-4">{user.email}</td>
                        <td className="py-3 pr-4 capitalize">{user.role}</td>
                        <td className="py-3 pr-4">
                          <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600">
                            {user.status}
                          </span>
                        </td>
                        <td className="py-3 pr-4">{formatDate(user.created_at)}</td>
                        <td className="py-3">{formatDate(user.last_login)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!usersState.loading && !usersState.error && usersState.totalPages > 1 && (
              <Pagination
                page={usersState.page}
                totalPages={usersState.totalPages}
                onPrev={() => setUsersState((prev) => ({ ...prev, page: Math.max(prev.page - 1, 1) }))}
                onNext={() =>
                  setUsersState((prev) => ({ ...prev, page: Math.min(prev.page + 1, prev.totalPages) }))
                }
              />
            )}
          </div>
        )}

        {activeTab === 'images' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
            <TableHeader title="Images" subtitle="Recent uploads and predictions." />

            {imagesState.loading && (
              <div className="flex items-center justify-center text-gray-600">
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Loading images...
              </div>
            )}

            {!imagesState.loading && imagesState.error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">
                {imagesState.error}
              </div>
            )}

            {!imagesState.loading && !imagesState.error && imagesState.data.length === 0 && (
              <EmptyState message="No images found." />
            )}

            {!imagesState.loading && !imagesState.error && imagesState.data.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-gray-500 border-b">
                    <tr>
                      <th className="py-2 pr-4">Image ID</th>
                      <th className="py-2 pr-4">User</th>
                      <th className="py-2 pr-4">Label</th>
                      <th className="py-2 pr-4">Confidence</th>
                      <th className="py-2 pr-4">Uploaded</th>
                      <th className="py-2">Predicted</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-700">
                    {imagesState.data.map((image) => (
                      <tr key={image.image_id} className="border-b last:border-0">
                        <td className="py-3 pr-4 font-medium text-gray-900">{image.image_id}</td>
                        <td className="py-3 pr-4">
                          <div className="text-gray-900">{image.full_name}</div>
                          <div className="text-xs text-gray-500">{image.email}</div>
                        </td>
                        <td className="py-3 pr-4 capitalize">{image.label || '—'}</td>
                        <td className="py-3 pr-4">{formatConfidence(image.confidence)}</td>
                        <td className="py-3 pr-4">{formatDate(image.uploaded_at)}</td>
                        <td className="py-3">{formatDate(image.predicted_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!imagesState.loading && !imagesState.error && imagesState.totalPages > 1 && (
              <Pagination
                page={imagesState.page}
                totalPages={imagesState.totalPages}
                onPrev={() => setImagesState((prev) => ({ ...prev, page: Math.max(prev.page - 1, 1) }))}
                onNext={() =>
                  setImagesState((prev) => ({ ...prev, page: Math.min(prev.page + 1, prev.totalPages) }))
                }
              />
            )}
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
            <TableHeader title="Reports" subtitle="Generated operator reports." />

            {reportsState.loading && (
              <div className="flex items-center justify-center text-gray-600">
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Loading reports...
              </div>
            )}

            {!reportsState.loading && reportsState.error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">
                {reportsState.error}
              </div>
            )}

            {!reportsState.loading && !reportsState.error && reportsState.data.length === 0 && (
              <EmptyState message="No reports available." />
            )}

            {!reportsState.loading && !reportsState.error && reportsState.data.length > 0 && (
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
                    {reportsState.data.map((report) => (
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
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!reportsState.loading && !reportsState.error && reportsState.totalPages > 1 && (
              <Pagination
                page={reportsState.page}
                totalPages={reportsState.totalPages}
                onPrev={() => setReportsState((prev) => ({ ...prev, page: Math.max(prev.page - 1, 1) }))}
                onNext={() =>
                  setReportsState((prev) => ({ ...prev, page: Math.min(prev.page + 1, prev.totalPages) }))
                }
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
