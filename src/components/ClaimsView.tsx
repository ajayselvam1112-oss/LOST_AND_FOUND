import { CheckCircle2, Clock, Loader2, ShieldCheck, XCircle } from 'lucide-react';
import { useState } from 'react';
import { apiRequest } from '../lib/api';
import type { ClaimRecord, User } from '../types';

interface ClaimsViewProps {
  claims: ClaimRecord[];
  loading: boolean;
  currentUser: User | null;
  onRefresh: () => void;
  onOpenItem: (itemId: number) => void;
  onRequireAuth: () => void;
}

export function ClaimsView({
  claims,
  loading,
  currentUser,
  onRefresh,
  onOpenItem,
  onRequireAuth,
}: ClaimsViewProps) {
  const [tab, setTab] = useState<'incoming' | 'outgoing'>('incoming');
  const [handoverCodes, setHandoverCodes] = useState<Record<number, string>>({});
  const [busyClaimId, setBusyClaimId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  if (!currentUser) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
        <ShieldCheck className="w-8 h-8 text-blue-700 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900">Sign in to manage verification claims</h2>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          Review ownership proof for items you found, track claims you submitted, and confirm safe handover codes.
        </p>
        <button
          type="button"
          onClick={onRequireAuth}
          className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          Sign In to Continue
        </button>
      </div>
    );
  }

  const incoming = claims.filter((c) => c.reporter_id === currentUser.id || currentUser.role === 'admin');
  const outgoing = claims.filter((c) => c.claimant_id === currentUser.id);
  const visibleClaims = tab === 'incoming' ? incoming : outgoing;

  async function reviewClaim(claimId: number, decision: 'approved' | 'rejected') {
    setBusyClaimId(claimId);
    setFeedback(null);
    try {
      await apiRequest(`/api/claims/${claimId}/review`, {
        method: 'PATCH',
        body: JSON.stringify({
          decision,
          reviewer_notes:
            decision === 'approved'
              ? 'Ownership details matched. Proceed with desk handover.'
              : 'Details did not match the private record.',
        }),
      });
      setFeedback({
        type: 'success',
        text: decision === 'approved' ? 'Claim approved and handover code sent.' : 'Claim rejected.',
      });
      onRefresh();
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Action failed.' });
    } finally {
      setBusyClaimId(null);
    }
  }

  async function completeHandover(claimId: number) {
    setBusyClaimId(claimId);
    setFeedback(null);
    try {
      await apiRequest(`/api/claims/${claimId}/complete`, {
        method: 'POST',
        body: JSON.stringify({ handover_code: handoverCodes[claimId] || '' }),
      });
      setFeedback({
        type: 'success',
        text: 'Handover verified! Item marked Returned and +50 points awarded to the finder.',
      });
      onRefresh();
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Handover verification failed.' });
    } finally {
      setBusyClaimId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Ownership Verification &amp; Claims
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Compare verification answers against private item details before releasing any belonging.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg self-start">
          <button
            type="button"
            onClick={() => setTab('incoming')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              tab === 'incoming' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {currentUser.role === 'admin' ? `All Verifications (${incoming.length})` : `Incoming Requests (${incoming.length})`}
          </button>
          <button
            type="button"
            onClick={() => setTab('outgoing')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              tab === 'outgoing' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            My Claims ({outgoing.length})
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-lg border text-xs font-medium ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 flex items-center justify-center gap-2 text-slate-500 text-sm">
          <Loader2 className="w-5 h-5 animate-spin text-blue-700" />
          <span>Loading verification queue...</span>
        </div>
      ) : visibleClaims.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-2">
          <Clock className="w-7 h-7 text-slate-400 mx-auto" />
          <h3 className="text-sm font-bold text-slate-900">
            {tab === 'incoming' ? 'No incoming verification requests' : 'You have not submitted any claims yet'}
          </h3>
          <p className="text-xs text-slate-500">
            {tab === 'incoming'
              ? 'When another student claims an item you found, their proof will appear here.'
              : 'Open any Found or Lost item from the directory to submit ownership proof.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleClaims.map((claim) => (
            <div key={claim.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono font-semibold text-slate-700">{claim.tracking_code}</span>
                    <span aria-hidden="true">·</span>
                    <span>{claim.block_name}</span>
                    <span aria-hidden="true">·</span>
                    <span className="capitalize">
                      {claim.status === 'approved' && <span className="text-emerald-700 font-semibold">Approved</span>}
                      {claim.status === 'pending' && <span className="text-amber-700 font-semibold">Pending Review</span>}
                      {claim.status === 'rejected' && <span className="text-red-700 font-semibold">Declined</span>}
                      {claim.status === 'completed' && <span className="text-blue-700 font-semibold">Returned</span>}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenItem(claim.item_id)}
                    className="text-base font-bold text-slate-900 hover:text-blue-700 transition-colors mt-1 text-left"
                  >
                    {claim.item_title}
                  </button>
                </div>

                <div className="text-xs text-slate-500">
                  Claimant: <span className="font-semibold text-slate-800">{claim.claimant_name}</span> (
                  {claim.claimant_student_id})
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                  <span className="font-semibold text-slate-900 block">Claimant’s Verification Answer</span>
                  <p className="text-slate-700 leading-relaxed">{claim.verification_answer}</p>
                  {claim.supporting_notes && (
                    <p className="text-slate-500 pt-1">Note: {claim.supporting_notes}</p>
                  )}
                </div>

                {claim.secret_detail ? (
                  <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 space-y-1">
                    <span className="font-semibold text-amber-900 block">Hidden Reference Detail</span>
                    <p className="text-amber-800 leading-relaxed">{claim.secret_detail}</p>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                    <span className="font-semibold text-slate-900 block">Coordinated Desk</span>
                    <p className="text-slate-600">{claim.warden_desk}</p>
                    {claim.reviewer_notes && (
                      <p className="text-slate-700 pt-1">Reviewer: {claim.reviewer_notes}</p>
                    )}
                  </div>
                )}
              </div>

              {claim.status === 'pending' &&
                (claim.reporter_id === currentUser.id || currentUser.role === 'admin') && (
                  <div className="flex items-center gap-3 pt-1">
                    <button
                      type="button"
                      disabled={busyClaimId === claim.id}
                      onClick={() => reviewClaim(claim.id, 'approved')}
                      className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Approve &amp; Generate Handover Code</span>
                    </button>
                    <button
                      type="button"
                      disabled={busyClaimId === claim.id}
                      onClick={() => reviewClaim(claim.id, 'rejected')}
                      className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Decline</span>
                    </button>
                  </div>
                )}

              {claim.status === 'approved' && (
                <div className="p-3.5 rounded-lg bg-blue-50 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-xs">
                    <span className="font-semibold text-blue-900">Handover Code: </span>
                    <span className="font-mono font-bold text-blue-800">{claim.handover_code}</span>
                    <span className="text-blue-700 block mt-0.5">
                      Confirm this code at {claim.warden_desk} to mark Returned &amp; award +50 points.
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={handoverCodes[claim.id] || ''}
                      onChange={(e) =>
                        setHandoverCodes((prev) => ({ ...prev, [claim.id]: e.target.value }))
                      }
                      placeholder={currentUser.role === 'admin' ? 'Optional for admin' : 'Enter code'}
                      className="w-32 px-2.5 py-1.5 text-xs font-mono bg-white border border-blue-300 rounded-lg"
                    />
                    <button
                      type="button"
                      disabled={busyClaimId === claim.id}
                      onClick={() => completeHandover(claim.id)}
                      className="px-3.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg whitespace-nowrap"
                    >
                      Confirm Return
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
