import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { getAdminUsers } from '../../utils/api';

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

export default function AccessControl({ navigate, onAddUser, onUpdateUser, onDeleteUser }) {
  const [query, setQuery] = useState('');
  const [state, setState] = useState({
    loading: false,
    error: '',
    data: [],
    page: 1,
    totalPages: 1
  });
  const [actionLoading, setActionLoading] = useState(false);

  const loadUsers = useCallback(async (page) => {
    setState((prev) => ({ ...prev, loading: true, error: '' }));
    try {
      const response = await getAdminUsers(page, 12);
      setState((prev) => ({
        ...prev,
        loading: false,
        data: response.data || [],
        totalPages: response.total_pages || 1
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error?.error || 'Unable to load users.'
      }));
    }
  }, []);

  useEffect(() => {
    loadUsers(state.page);
  }, [state.page, loadUsers]);

  const handleAdd = async () => {
    if (!onAddUser) return;

    const full_name = window.prompt('Full name:');
    if (!full_name) return;
    const email = window.prompt('Email:');
    if (!email) return;
    const password = window.prompt('Temporary password (min 8 chars):');
    if (!password) return;
    const role = window.prompt('Role (user/admin):', 'user') || 'user';

    try {
      setActionLoading(true);
      await onAddUser({ full_name, email, password, password_confirm: password, role });
      await loadUsers(state.page);
    } catch (error) {
      setState((prev) => ({ ...prev, error: error?.error || error?.message || 'Unable to add user.' }));
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdate = async (user) => {
    if (!onUpdateUser) return;

    const full_name = window.prompt('Full name:', user.full_name || '');
    if (!full_name) return;
    const status = window.prompt('Status (ACTIVE/INACTIVE):', user.status || 'ACTIVE');
    const role = window.prompt('Role (user/admin):', user.role || 'user');

    try {
      setActionLoading(true);
      await onUpdateUser(user.user_id, { full_name, status, role });
      await loadUsers(state.page);
    } catch (error) {
      setState((prev) => ({ ...prev, error: error?.error || error?.message || 'Unable to update user.' }));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (user) => {
    if (!onDeleteUser) return;
    const confirmed = window.confirm(`Delete user "${user.full_name}"?`);
    if (!confirmed) return;

    try {
      setActionLoading(true);
      await onDeleteUser(user.user_id);
      await loadUsers(state.page);
    } catch (error) {
      setState((prev) => ({ ...prev, error: error?.error || error?.message || 'Unable to delete user.' }));
    } finally {
      setActionLoading(false);
    }
  };

  const filteredUsers = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return state.data;
    return state.data.filter((user) => {
      const name = String(user.full_name || '').toLowerCase();
      const email = String(user.email || '').toLowerCase();
      const role = String(user.role || '').toLowerCase();
      return name.includes(trimmed) || email.includes(trimmed) || role.includes(trimmed);
    });
  }, [query, state.data]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Access Control</h1>
            <p className="text-sm text-gray-500">Review roles, status, and access details.</p>
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
              <h2 className="text-lg font-semibold text-gray-900">User Directory</h2>
              <p className="text-sm text-gray-500">Search admins and operators by role or email.</p>
            </div>
            <div className="flex w-full md:w-auto gap-2">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search users"
                  className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <button
                onClick={handleAdd}
                disabled={!onAddUser || actionLoading}
                className="bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 disabled:opacity-50"
              >
                Add User
              </button>
            </div>
          </div>

          {state.loading && (
            <div className="flex items-center justify-center text-gray-600">
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Loading users...
            </div>
          )}

          {!state.loading && state.error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">
              {state.error}
            </div>
          )}

          {!state.loading && !state.error && filteredUsers.length === 0 && (
            <EmptyState message="No matching users found." />
          )}

          {!state.loading && !state.error && filteredUsers.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-[980px] table-fixed text-sm">
                <thead className="text-left text-gray-500 border-b">
                  <tr>
                    <th className="py-2 px-4 w-[18%]">User</th>
                    <th className="py-2 px-4 w-[24%]">Email</th>
                    <th className="py-2 px-4 w-[12%]">Role</th>
                    <th className="py-2 px-4 w-[12%]">Status</th>
                    <th className="py-2 px-4 w-[17%]">Created</th>
                    <th className="py-2 px-4 w-[17%]">Last Login</th>
                    <th className="py-2 px-4 w-[15%]">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700">
                  {filteredUsers.map((user) => (
                    <tr key={user.user_id} className="border-b last:border-0">
                      <td className="py-3 px-4 align-top">
                        <div className="font-medium text-gray-900 break-words">{user.full_name}</div>
                      </td>
                      <td className="py-3 px-4 align-top break-all">{user.email}</td>
                      <td className="py-3 px-4 align-top uppercase whitespace-nowrap">{user.role}</td>
                      <td className="py-3 px-4 align-top whitespace-nowrap">
                        <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600">
                          {user.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 align-top whitespace-nowrap">{formatDate(user.created_at)}</td>
                      <td className="py-3 px-4 align-top whitespace-nowrap">{formatDate(user.last_login)}</td>
                      <td className="py-3 px-4 align-top">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleUpdate(user)}
                            disabled={!onUpdateUser || actionLoading}
                            className="px-2 py-1 rounded border border-gray-200 hover:border-green-500 disabled:opacity-50"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(user)}
                            disabled={!onDeleteUser || actionLoading}
                            className="px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
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
