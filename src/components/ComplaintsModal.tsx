import { Loader2, MessageSquareWarning, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { apiRequest } from '../lib/api';
import type { ItemRecord } from '../types';

interface ComplaintsModalProps {
  isOpen: boolean;
  relatedItem: ItemRecord | null;
  onClose: () => void;
  onSubmitted: () => void;
}

export function ComplaintsModal({
  isOpen,
  relatedItem,
  onClose,
  onSubmitted,
}: ComplaintsModalProps) {
  const [subject, setSubject] = useState(
    relatedItem ? `Dispute / Inquiry regarding ${relatedItem.tracking_code}` : ''
  );
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (subject.trim().length < 5 || details.trim().length < 12) {
      setError('Please enter a clear subject (5+ chars) and explanation (12+ chars).');
      return;
    }

    setSubmitting(true);
    try {
      await apiRequest('/api/complaints', {
        method: 'POST',
        body: JSON.stringify({
          item_id: relatedItem?.id || null,
          subject: subject.trim(),
          details: details.trim(),
        }),
      });
      onSubmitted();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit ticket.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="complaint-modal-title"
    >
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <MessageSquareWarning className="w-4 h-4 text-blue-700" />
            <h2 id="complaint-modal-title" className="text-base font-bold text-slate-900">
              Contact Hostel Warden / File Dispute
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close support modal"
            className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-700">
              {error}
            </div>
          )}

          {relatedItem && (
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700">
              Linked Item: <span className="font-mono font-semibold">{relatedItem.tracking_code}</span> ·{' '}
              {relatedItem.title}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Subject</label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Suspected false claim or request for desk handover time"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Details</label>
            <textarea
              required
              rows={4}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Explain what happened and how the hostel warden can assist."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-2"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Submit to Warden</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
