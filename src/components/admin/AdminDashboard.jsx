import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BrainCircuit,
  FileText,
  Images,
  Loader2,
  ShieldCheck,
  Users
} from 'lucide-react';
import {
  getAdminImages,
  getAdminReports,
  getAdminUsers,
  getRetrainingQueue
} from '../../utils/api';
import RetrainingQueueScreen from './RetrainingQueueScreen';

const PAGE_SIZE = 10;

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
};

const formatConfidence = (confidence) => {
  if (confidence === null || confidence === undefined) return '-';
  const numeric = Number(confidence);
  if (Number.isNaN(numeric)) return '-';
  return `${Math.round(numeric * 100)}%`;
};

const EmptyState = ({ message }) => (
  <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center text-sm text-gray-500">
    {message}
  </div>
);

const TableCard = ({ title, subtitle, children }) => (
  <section className="rounded-3xl border border-green-100 bg-white p-6 shadow-sm">
    <header className="mb-5 flex flex-col gap-1">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      {subtitle ? <p className="text-sm text-gray-500">{subtitle}</p> : null}
    </header>
    {children}
  </section>
);

const Pagination = ({ page, totalPages, onPrev, onNext }) => {
  if (totalPages <= 1) return null;

  return (
    <div className="mt-5 flex items-center justify-between border-t border-gray-200 pt-4 text-sm text-gray-600">
      <button
        onClick={onPrev}
        disabled={page <= 1}
        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 font-medium transition hover:border-green-500 hover:text-green-700 disabled:cursor-not-allowed disabled:opacity-45"
      >
        Previous
      </button>
      <span>
        Page {page} of {totalPages}
      </span>
      <button
        onClick={onNext}
        disabled={page >= totalPages}
        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 font-medium transition hover:border-green-500 hover:text-green-700 disabled:cursor-not-allowed disabled:opacity-45"
      >
        Next
      </button>
    </div>
  );
};

const tabMeta = {
  users: { label: 'Users', icon: Users },
  images: { label: 'Images', icon: Images },
  reports: { label: 'Reports', icon: FileText },
  retraining: { label: 'Retraining', icon: BrainCircuit }
};

export default function AdminDashboard({ navigate }) {
  const [activeTab, setActiveTab] = useState('users');

  const [usersState, setUsersState] = useState({
    loading: false,
    error: '',
    data: [],
    page: 1,
    totalPages: 1,
    total: 0
  });

  const [imagesState, setImagesState] = useState({
    loading: false,
    error: '',
    data: [],
    page: 1,
    totalPages: 1,
    total: 0
  });

  const [reportsState, setReportsState] = useState({
    loading: false,
    error: '',
    data: [],
    page: 1,
    totalPages: 1,
    total: 0
  });

  const [pendingRetraining, setPendingRetraining] = useState(null);

  const tabs = useMemo(
    () => [
      { key: 'users', ...tabMeta.users, count: usersState.total },
      { key: 'images', ...tabMeta.images, count: imagesState.total },
      { key: 'reports', ...tabMeta.reports, count: reportsState.total },
      { key: 'retraining', ...tabMeta.retraining, count: pendingRetraining ?? 0 }
    ],
    [usersState.total, imagesState.total, reportsState.total, pendingRetraining]
  );

  useEffect(() => {
    let isMounted = true;

    const loadUsers = async () => {
      setUsersState((prev) => ({ ...prev, loading: true, error: '' }));
      try {
        const response = await getAdminUsers(usersState.page, PAGE_SIZE);
        if (!isMounted) return;
        setUsersState((prev) => ({
          ...prev,
          loading: false,
          data: response.data || [],
          totalPages: response.total_pages || 1,
          total: Number(response.total || 0)
        }));
      } catch (error) {
        if (!isMounted) return;
        setUsersState((prev) => ({
          ...prev,
          loading: false,
          error: error?.detail || error?.error || 'Unable to load users.'
        }));
      }
    };

    const loadImages = async () => {
      setImagesState((prev) => ({ ...prev, loading: true, error: '' }));
      try {
        const response = await getAdminImages(imagesState.page, PAGE_SIZE);
        if (!isMounted) return;
        setImagesState((prev) => ({
          ...prev,
          loading: false,
          data: response.data || [],
          totalPages: response.total_pages || 1,
          total: Number(response.total || 0)
        }));
      } catch (error) {
        if (!isMounted) return;
        setImagesState((prev) => ({
          ...prev,
          loading: false,
          error: error?.detail || error?.error || 'Unable to load images.'
        }));
      }
    };

    const loadReports = async () => {
      setReportsState((prev) => ({ ...prev, loading: true, error: '' }));
      try {
        const response = await getAdminReports(reportsState.page, PAGE_SIZE);
        if (!isMounted) return;
        setReportsState((prev) => ({
          ...prev,
          loading: false,
          data: response.data || [],
          totalPages: response.total_pages || 1,
          total: Number(response.total || 0)
        }));
      } catch (error) {
        if (!isMounted) return;
        setReportsState((prev) => ({
          ...prev,
          loading: false,
          error: error?.detail || error?.error || 'Unable to load reports.'
        }));
      }
    };

    const loadPending = async () => {
      try {
        const response = await getRetrainingQueue(1, 1, 'PENDING');
        if (!isMounted) return;
        setPendingRetraining(Number(response.total || 0));
      } catch {
        if (!isMounted) return;
        setPendingRetraining(0);
      }
    };

    if (activeTab === 'users') loadUsers();
    if (activeTab === 'images') loadImages();
    if (activeTab === 'reports') loadReports();
    loadPending();

    return () => {
      isMounted = false;
    };
  }, [activeTab, usersState.page, imagesState.page, reportsState.page]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white">
      <header className="border-b border-green-700/20 bg-gradient-to-r from-green-600 to-green-700 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-6 py-7 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs uppercase tracking-wide">
              <ShieldCheck className="h-4 w-4" />
              Admin Workspace
            </div>
            <h1 className="mt-3 text-3xl font-semibold">VisionQC Control Center</h1>
            <p className="mt-1 text-sm text-white/90">
              Monitor users, image traffic, reports, and model retraining from one place.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => navigate('admin-access')}
              className="rounded-lg border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium transition hover:bg-white/20"
            >
              Access Control
            </button>
            <button
              onClick={() => navigate('admin-reports')}
              className="rounded-lg border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium transition hover:bg-white/20"
            >
              Reports
            </button>
            <button
              onClick={() => navigate('admin-dashboard')}
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-green-700 transition hover:bg-green-50"
            >
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-6">
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <button
            onClick={() => setActiveTab('users')}
            className="group rounded-2xl border border-green-100 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow"
          >
            <Users className="mb-3 h-5 w-5 text-green-600" />
            <p className="text-xs uppercase tracking-wide text-gray-500">Users</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{usersState.total}</p>
            <p className="mt-1 text-xs text-gray-500">Registered accounts</p>
          </button>

          <button
            onClick={() => setActiveTab('images')}
            className="group rounded-2xl border border-green-100 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow"
          >
            <Images className="mb-3 h-5 w-5 text-green-600" />
            <p className="text-xs uppercase tracking-wide text-gray-500">Images</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{imagesState.total}</p>
            <p className="mt-1 text-xs text-gray-500">Uploaded scans</p>
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className="group rounded-2xl border border-green-100 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow"
          >
            <FileText className="mb-3 h-5 w-5 text-green-600" />
            <p className="text-xs uppercase tracking-wide text-gray-500">Reports</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{reportsState.total}</p>
            <p className="mt-1 text-xs text-gray-500">Generated files</p>
          </button>

          <button
            onClick={() => setActiveTab('retraining')}
            className="group rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-100 to-red-50 p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow"
          >
            <BrainCircuit className="mb-3 h-5 w-5 text-red-600" />
            <p className="text-xs uppercase tracking-wide text-red-500">Retraining Queue</p>
            <p className="mt-1 text-2xl font-semibold text-red-700">{pendingRetraining ?? '-'}</p>
            <p className="mt-1 text-xs text-red-700">Pending model reviews</p>
          </button>
        </section>

        <section className="rounded-2xl border border-green-100 bg-white p-3 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;

              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
                    isActive
                      ? 'bg-gradient-to-r from-green-600 to-green-700 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      isActive ? 'bg-white/20 text-white' : 'bg-white text-gray-600'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {activeTab === 'users' && (
          <TableCard title="Users" subtitle="Active accounts, roles, and latest sign-in activity.">
            {usersState.loading ? (
              <div className="flex items-center justify-center py-10 text-gray-600">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading users...
              </div>
            ) : null}

            {!usersState.loading && usersState.error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {usersState.error}
              </div>
            ) : null}

            {!usersState.loading && !usersState.error && usersState.data.length === 0 ? (
              <EmptyState message="No users available yet." />
            ) : null}

            {!usersState.loading && !usersState.error && usersState.data.length > 0 ? (
              <div className="overflow-x-auto rounded-2xl border border-gray-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-4 py-3">User</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Created</th>
                      <th className="px-4 py-3">Last Login</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-700">
                    {usersState.data.map((user) => (
                      <tr key={user.user_id} className="border-t border-gray-100 hover:bg-gray-50/80">
                        <td className="px-4 py-3 font-medium text-gray-900">{user.full_name}</td>
                        <td className="px-4 py-3">{user.email}</td>
                        <td className="px-4 py-3 capitalize">{user.role}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                              String(user.status).toUpperCase() === 'ACTIVE'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-200 text-gray-700'
                            }`}
                          >
                            {user.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">{formatDate(user.created_at)}</td>
                        <td className="px-4 py-3">{formatDate(user.last_login)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            <Pagination
              page={usersState.page}
              totalPages={usersState.totalPages}
              onPrev={() => setUsersState((prev) => ({ ...prev, page: Math.max(prev.page - 1, 1) }))}
              onNext={() =>
                setUsersState((prev) => ({ ...prev, page: Math.min(prev.page + 1, prev.totalPages) }))
              }
            />
          </TableCard>
        )}

        {activeTab === 'images' && (
          <TableCard title="Images" subtitle="Recent uploads linked to prediction outcomes.">
            {imagesState.loading ? (
              <div className="flex items-center justify-center py-10 text-gray-600">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading images...
              </div>
            ) : null}

            {!imagesState.loading && imagesState.error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {imagesState.error}
              </div>
            ) : null}

            {!imagesState.loading && !imagesState.error && imagesState.data.length === 0 ? (
              <EmptyState message="No images found." />
            ) : null}

            {!imagesState.loading && !imagesState.error && imagesState.data.length > 0 ? (
              <div className="overflow-x-auto rounded-2xl border border-gray-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-4 py-3">Image ID</th>
                      <th className="px-4 py-3">User</th>
                      <th className="px-4 py-3">Label</th>
                      <th className="px-4 py-3">Confidence</th>
                      <th className="px-4 py-3">Uploaded</th>
                      <th className="px-4 py-3">Predicted</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-700">
                    {imagesState.data.map((image) => (
                      <tr key={image.image_id} className="border-t border-gray-100 hover:bg-gray-50/80">
                        <td className="px-4 py-3 font-semibold text-gray-900">#{image.image_id}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{image.full_name}</div>
                          <div className="text-xs text-gray-500">{image.email}</div>
                        </td>
                        <td className="px-4 py-3 capitalize">{image.label || '-'}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                            {formatConfidence(image.confidence)}
                          </span>
                        </td>
                        <td className="px-4 py-3">{formatDate(image.uploaded_at)}</td>
                        <td className="px-4 py-3">{formatDate(image.predicted_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            <Pagination
              page={imagesState.page}
              totalPages={imagesState.totalPages}
              onPrev={() => setImagesState((prev) => ({ ...prev, page: Math.max(prev.page - 1, 1) }))}
              onNext={() =>
                setImagesState((prev) => ({ ...prev, page: Math.min(prev.page + 1, prev.totalPages) }))
              }
            />
          </TableCard>
        )}

        {activeTab === 'reports' && (
          <TableCard title="Reports" subtitle="Operator report history and downloadable exports.">
            {reportsState.loading ? (
              <div className="flex items-center justify-center py-10 text-gray-600">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading reports...
              </div>
            ) : null}

            {!reportsState.loading && reportsState.error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {reportsState.error}
              </div>
            ) : null}

            {!reportsState.loading && !reportsState.error && reportsState.data.length === 0 ? (
              <EmptyState message="No reports available." />
            ) : null}

            {!reportsState.loading && !reportsState.error && reportsState.data.length > 0 ? (
              <div className="overflow-x-auto rounded-2xl border border-gray-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-4 py-3">Report</th>
                      <th className="px-4 py-3">Operator</th>
                      <th className="px-4 py-3">Format</th>
                      <th className="px-4 py-3">Created</th>
                      <th className="px-4 py-3">Download</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-700">
                    {reportsState.data.map((report) => (
                      <tr key={report.report_id} className="border-t border-gray-100 hover:bg-gray-50/80">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-gray-900 capitalize">{report.report_type}</div>
                          <div className="text-xs text-gray-500">#{report.report_id}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{report.operator_name}</div>
                          <div className="text-xs text-gray-500">{report.operator_email}</div>
                        </td>
                        <td className="px-4 py-3 uppercase">{report.format}</td>
                        <td className="px-4 py-3">{formatDate(report.created_at)}</td>
                        <td className="px-4 py-3">
                          {report.download_link ? (
                            <a
                              href={report.download_link}
                              className="inline-flex items-center gap-1 rounded-md border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700 transition hover:bg-green-100"
                              target="_blank"
                              rel="noreferrer"
                            >
                              Download
                            </a>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            <Pagination
              page={reportsState.page}
              totalPages={reportsState.totalPages}
              onPrev={() => setReportsState((prev) => ({ ...prev, page: Math.max(prev.page - 1, 1) }))}
              onNext={() =>
                setReportsState((prev) => ({ ...prev, page: Math.min(prev.page + 1, prev.totalPages) }))
              }
            />
          </TableCard>
        )}

        {activeTab === 'retraining' ? (
          <section className="rounded-3xl border border-green-100 bg-white p-2 shadow-sm">
            <RetrainingQueueScreen embedded />
          </section>
        ) : null}

        <div className="rounded-2xl border border-green-100 bg-white p-4 text-xs text-gray-500">
          <div className="inline-flex items-center gap-2">
            <Activity className="h-4 w-4 text-green-600" />
            Dashboard updates as you switch tabs. Use Access Control and Reports shortcuts above for deep tasks.
          </div>
        </div>
      </main>
    </div>
  );
}

