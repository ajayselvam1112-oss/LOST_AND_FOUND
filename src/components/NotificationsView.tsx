import { Bell, CheckCheck, MessageSquareWarning, Plus } from 'lucide-react';
import { apiRequest } from '../lib/api';
import type { ComplaintRecord, NotificationRecord, User } from '../types';

interface NotificationsViewProps {
  notifications: NotificationRecord[];
  complaints: ComplaintRecord[];
  currentUser: User | null;
  onRefresh: () => void;
  onOpenItem: (itemId: number) => void;
  onOpenNewComplaint: () => void;
  onRequireAuth: () => void;
}

export function NotificationsView({
  notifications,
  complaints,
  currentUser,
  onRefresh,
  onOpenItem,
  onOpenNewComplaint,
  onRequireAuth,
}: NotificationsViewProps) {
  if (!currentUser) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
        <Bell className="w-8 h-8 text-blue-700 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900">Sign in to view notifications &amp; support</h2>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          Receive automatic alerts when a matching item is posted, when someone claims an item, or when your handover code is ready.
        </p>
        <button
          type="button"
          onClick={onRequireAuth}
          className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg"
        >
          Sign In
        </button>
      </div>
    );
  }

  async function markOneRead(id: number) {
    await apiRequest(`/api/notifications/${id}/read`, { method: 'PATCH' });
    onRefresh();
  }

  async function markAllRead() {
    await apiRequest('/api/notifications/read-all', { method: 'PATCH' });
    onRefresh();
  }

  const unreadCount = notifications.filter((n) => n.is_read === 0).length;

  return (
    <div className="space-y-8">
      {/* Notifications Section */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Notifications &amp; Match Alerts
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Smart item matches, claim verifications, and handover confirmations.
            </p>
          </div>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-800 rounded-lg inline-flex items-center gap-1.5 self-start"
            >
              <CheckCheck className="w-4 h-4 text-blue-700" />
              <span>Mark all as read ({unreadCount})</span>
            </button>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No notifications yet. You will be alerted automatically when matching items appear.
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  n.is_read === 0 ? 'bg-blue-50/40' : 'bg-white'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold uppercase text-blue-700">{n.category}</span>
                    <span aria-hidden="true" className="text-slate-300">
                      ·
                    </span>
                    <span className="font-mono tabular-nums text-slate-500">
                      {n.created_at.slice(0, 16).replace('T', ' ')}
                    </span>
                    {n.is_read === 0 && (
                      <>
                        <span aria-hidden="true" className="text-slate-300">
                          ·
                        </span>
                        <span className="font-semibold text-slate-900">Unread</span>
                      </>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">{n.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{n.message}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {n.related_item_id && (
                    <button
                      type="button"
                      onClick={() => {
                        if (n.is_read === 0) markOneRead(n.id);
                        onOpenItem(n.related_item_id!);
                      }}
                      className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg whitespace-nowrap"
                    >
                      View Item
                    </button>
                  )}
                  {n.is_read === 0 && (
                    <button
                      type="button"
                      onClick={() => markOneRead(n.id)}
                      className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg whitespace-nowrap"
                    >
                      Mark Read
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Support Tickets Section */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Warden Support &amp; Dispute Tickets</h2>
            <p className="text-xs text-slate-600">
              Need help coordinating a desk pickup or disputing a false claim? Contact your hostel warden.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenNewComplaint}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 self-start"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Support Ticket</span>
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
          {complaints.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 space-y-1">
              <MessageSquareWarning className="w-6 h-6 text-slate-400 mx-auto" />
              <p>You have not submitted any support tickets or disputes.</p>
            </div>
          ) : (
            complaints.map((c) => (
              <div key={c.id} className="p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-sm text-slate-900">{c.subject}</span>
                  <span className="font-semibold uppercase text-slate-700">{c.status}</span>
                </div>
                <p className="text-slate-600">{c.details}</p>
                {c.admin_response && (
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-800">
                    <span className="font-semibold">Warden Reply: </span>
                    {c.admin_response}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
