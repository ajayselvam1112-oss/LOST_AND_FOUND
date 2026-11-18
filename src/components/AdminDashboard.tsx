import { Loader2, Shield, Trash2, UserCheck, UserX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiRequest } from '../lib/api';
import {
  ITEM_STATUSES,
  type AdminOverview,
  type AdminUserRecord,
  type ComplaintRecord,
  type ItemRecord,
  type ItemStatus,
} from '../types';
import { StatusIndicator } from './StatusBadge';

interface AdminDashboardProps {
  items: ItemRecord[];
  onRefreshItems: () => void;
  onOpenItem: (itemId: number) => void;
}

export function AdminDashboard({ items, onRefreshItems, onOpenItem }: AdminDashboardProps) {
  const [tab, setTab] = useState<'items' | 'users' | 'complaints'>('items');
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [complaints, setComplaints] = useState<ComplaintRecord[]>([]);
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({});
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');

  async function loadAdminData() {
    setLoading(true);
    setError('');
    try {
      const [ov, usr, cmp] = await Promise.all([
        apiRequest<AdminOverview>('/api/admin/overview'),
        apiRequest<{ users: AdminUserRecord[] }>('/api/admin/users'),
        apiRequest<{ complaints: ComplaintRecord[] }>('/api/complaints'),
      ]);
      setOverview(ov);
      setUsers(usr.users);
      setComplaints(cmp.complaints);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load warden console.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAdminData();
  }, []);

  async function updateItemStatus(itemId: number, nextStatus: ItemStatus) {
    setError('');
    setStatusMessage('');
    try {
      await apiRequest(`/api/items/${itemId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      setStatusMessage(`Item #${itemId} status updated to ${nextStatus}.`);
      onRefreshItems();
      loadAdminData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed.');
    }
  }

  async function deleteItem(itemId: number) {
    setError('');
    setStatusMessage('');
    try {
      await apiRequest(`/api/admin/items/${itemId}`, { method: 'DELETE' });
      setStatusMessage(`Removed report #${itemId}.`);
      onRefreshItems();
      loadAdminData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete report.');
    }
  }

  async function toggleUserActive(user: AdminUserRecord) {
    setError('');
    setStatusMessage('');
    try {
      await apiRequest(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: user.is_active !== 1 }),
      });
      setStatusMessage(
        `${user.full_name} account ${user.is_active === 1 ? 'suspended' : 'reactivated'}.`
      );
      loadAdminData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update student status.');
    }
  }

  async function updateComplaint(complaintId: number, status: ComplaintRecord['status']) {
    setError('');
    setStatusMessage('');
    try {
      await apiRequest(`/api/admin/complaints/${complaintId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          admin_response: replyDrafts[complaintId] || `Ticket updated to ${status} by Hostel Warden.`,
        }),
      });
      setStatusMessage(`Complaint ticket #${complaintId} marked ${status}.`);
      loadAdminData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update ticket.');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Warden &amp; Admin Console
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Manage hostel item records, student accounts, verification disputes, and platform maintenance.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg self-start">
          <button
            type="button"
            onClick={() => setTab('items')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              tab === 'items' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Reports ({items.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('users')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              tab === 'users' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Students ({users.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('complaints')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              tab === 'complaints' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Complaints ({complaints.length})
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-700">
          {error}
        </div>
      )}
      {statusMessage && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800">
          {statusMessage}
        </div>
      )}

      {/* Platform KPI Strip */}
      {overview && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <span className="text-xs text-slate-500">Total Reports</span>
            <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
              {overview.itemStats.total_items}
            </div>
            <span className="text-xs text-slate-500 mt-1 block">
              {overview.itemStats.returned_count} returned · {overview.itemStats.pending_count} pending
            </span>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <span className="text-xs text-slate-500">Registered Students</span>
            <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
              {overview.userStats.total_users}
            </div>
            <span className="text-xs text-slate-500 mt-1 block">
              {overview.userStats.active_users} active accounts
            </span>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <span className="text-xs text-slate-500">Verification Claims</span>
            <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
              {overview.claimStats.total_claims}
            </div>
            <span className="text-xs text-amber-700 font-medium mt-1 block">
              {overview.claimStats.pending_claims} awaiting review
            </span>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <span className="text-xs text-slate-500">Support &amp; Disputes</span>
            <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
              {overview.complaintStats.total_complaints}
            </div>
            <span className="text-xs text-red-700 font-medium mt-1 block">
              {overview.complaintStats.open_complaints} open tickets
            </span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 flex items-center justify-center gap-2 text-sm text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin text-blue-700" />
          <span>Loading administration records...</span>
        </div>
      ) : (
        <>
          {tab === 'items' && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
                      <th className="py-2.5 px-4">Code</th>
                      <th className="py-2.5 px-4">Item</th>
                      <th className="py-2.5 px-4">Block</th>
                      <th className="py-2.5 px-4">Reporter</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {items.map((it) => (
                      <tr key={it.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-mono tabular-nums font-semibold text-slate-600">
                          {it.tracking_code}
                        </td>
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => onOpenItem(it.id)}
                            className="font-semibold text-slate-900 hover:text-blue-700 text-left"
                          >
                            {it.title}
                          </button>
                          <div className="text-[11px] text-slate-500">
                            {it.type.toUpperCase()} · {it.category}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-600">{it.block_name}</td>
                        <td className="py-3 px-4 text-slate-600">{it.reporter_name}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <StatusIndicator status={it.status} />
                            <select
                              aria-label={`Change status for ${it.tracking_code}`}
                              value={it.status}
                              onChange={(e) => updateItemStatus(it.id, e.target.value as ItemStatus)}
                              className="px-2 py-1 text-[11px] border border-slate-300 rounded bg-white"
                            >
                              {ITEM_STATUSES.map((st) => (
                                <option key={st} value={st}>
                                  {st}
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => deleteItem(it.id)}
                            className="inline-flex items-center gap-1 text-red-700 hover:text-red-900 font-medium"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remove</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'users' && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
                      <th className="py-2.5 px-4">Student ID</th>
                      <th className="py-2.5 px-4">Name &amp; Email</th>
                      <th className="py-2.5 px-4">Block &amp; Room</th>
                      <th className="py-2.5 px-4 text-right">Points</th>
                      <th className="py-2.5 px-4">Account</th>
                      <th className="py-2.5 px-4 text-right">Manage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-mono font-semibold text-slate-700">{u.student_id}</td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">
                            {u.full_name} {u.role === 'admin' && '· Warden Admin'}
                          </div>
                          <div className="text-[11px] text-slate-500">{u.email}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {u.block_name || 'Campus HQ'} · {u.room_number}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-800">
                          {u.points}
                        </td>
                        <td className="py-3 px-4">
                          {u.is_active === 1 ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                              <Shield className="w-3.5 h-3.5" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-red-700 font-semibold">
                              <UserX className="w-3.5 h-3.5" />
                              Suspended
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {u.role !== 'admin' && (
                            <button
                              type="button"
                              onClick={() => toggleUserActive(u)}
                              className="inline-flex items-center gap-1 text-blue-700 hover:underline font-semibold"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>{u.is_active === 1 ? 'Suspend' : 'Reactivate'}</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'complaints' && (
            <div className="space-y-4">
              {complaints.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-xs text-slate-500">
                  No student complaints or disputes filed.
                </div>
              ) : (
                complaints.map((c) => (
                  <div key={c.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">{c.subject}</h3>
                        <p className="text-xs text-slate-500">
                          Filed by {c.user_name} ({c.student_id})
                          {c.tracking_code ? ` · Item ${c.tracking_code}` : ''}
                        </p>
                      </div>
                      <span className="text-xs font-semibold uppercase text-slate-700">{c.status}</span>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">{c.details}</p>
                    {c.admin_response && (
                      <p className="text-xs text-blue-800 bg-blue-50 border border-blue-200 rounded-lg p-2.5">
                        Warden Response: {c.admin_response}
                      </p>
                    )}
                    <div className="flex flex-col sm:flex-row gap-2 pt-1">
                      <input
                        type="text"
                        value={replyDrafts[c.id] || ''}
                        onChange={(e) =>
                          setReplyDrafts((prev) => ({ ...prev, [c.id]: e.target.value }))
                        }
                        placeholder="Write warden resolution response..."
                        className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateComplaint(c.id, 'investigating')}
                          className="px-3 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg"
                        >
                          Investigating
                        </button>
                        <button
                          type="button"
                          onClick={() => updateComplaint(c.id, 'resolved')}
                          className="px-3 py-1.5 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg"
                        >
                          Resolve
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
