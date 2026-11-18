import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Loader2,
  Lock,
  MapPin,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react';
import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { apiRequest, uploadImageFile } from '../lib/api';
import { ITEM_STATUSES, type ClaimRecord, type ItemRecord, type ItemStatus, type User } from '../types';
import { ItemPinPreviewMap } from './ItemMapComponents';
import { ItemPhoto, StatusIndicator } from './StatusBadge';

interface ItemDetailModalProps {
  itemId: number | null;
  currentUser: User | null;
  onClose: () => void;
  onRequireAuth: () => void;
  onRefresh: () => void;
  onOpenComplaint: (item: ItemRecord) => void;
}

export function ItemDetailModal({
  itemId,
  currentUser,
  onClose,
  onRequireAuth,
  onRefresh,
  onOpenComplaint,
}: ItemDetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [item, setItem] = useState<ItemRecord | null>(null);
  const [userClaim, setUserClaim] = useState<ClaimRecord | null>(null);
  const [claims, setClaims] = useState<ClaimRecord[]>([]);

  // Claim submission form
  const [verificationAnswer, setVerificationAnswer] = useState('');
  const [supportingNotes, setSupportingNotes] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [submittingClaim, setSubmittingClaim] = useState(false);

  // Handover code completion
  const [handoverInput, setHandoverInput] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  async function loadItemDetails() {
    if (!itemId) return;
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest<{
        item: ItemRecord;
        user_claim: ClaimRecord | null;
        claims: ClaimRecord[];
      }>(`/api/items/${itemId}`);
      setItem(data.item);
      setUserClaim(data.user_claim);
      setClaims(data.claims || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load item details.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setSuccessMsg('');
    setVerificationAnswer('');
    setSupportingNotes('');
    setEvidenceUrl('');
    setHandoverInput('');
    if (itemId) {
      loadItemDetails();
    } else {
      setItem(null);
    }
  }, [itemId, currentUser?.id]);

  if (!itemId) return null;

  async function handleEvidenceUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setUploadingEvidence(true);
    try {
      const url = await uploadImageFile(file);
      setEvidenceUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload supporting photo.');
    } finally {
      setUploadingEvidence(false);
    }
  }

  async function handleSubmitClaim(e: FormEvent) {
    e.preventDefault();
    if (!item) return;
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    setError('');
    setSuccessMsg('');
    if (verificationAnswer.trim().length < 12) {
      setError('Please provide detailed identifying proof (at least 12 characters).');
      return;
    }
    setSubmittingClaim(true);
    try {
      await apiRequest(`/api/items/${item.id}/claims`, {
        method: 'POST',
        body: JSON.stringify({
          claim_type: item.type === 'found' ? 'claim_found_item' : 'report_found_for_lost',
          verification_answer: verificationAnswer.trim(),
          supporting_evidence_url: evidenceUrl,
          supporting_notes: supportingNotes.trim(),
        }),
      });
      setSuccessMsg('Verification request submitted. The reporter will review your details.');
      await loadItemDetails();
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit verification.');
    } finally {
      setSubmittingClaim(false);
    }
  }

  async function handleStatusChange(nextStatus: ItemStatus) {
    if (!item) return;
    setActionLoading(true);
    setError('');
    try {
      await apiRequest(`/api/items/${item.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      setSuccessMsg(`Item status updated to ${nextStatus}.`);
      await loadItemDetails();
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Status update failed.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReviewClaim(claimId: number, decision: 'approved' | 'rejected') {
    setActionLoading(true);
    setError('');
    try {
      const note =
        decision === 'approved'
          ? 'Ownership details matched accurately. Coordinate handover at the block desk.'
          : 'Submitted identifying details did not match the item record.';
      await apiRequest(`/api/claims/${claimId}/review`, {
        method: 'PATCH',
        body: JSON.stringify({ decision, reviewer_notes: note }),
      });
      setSuccessMsg(decision === 'approved' ? 'Claim approved and handover code generated.' : 'Claim declined.');
      await loadItemDetails();
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Review failed.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCompleteHandover(claimId: number) {
    setActionLoading(true);
    setError('');
    try {
      await apiRequest(`/api/claims/${claimId}/complete`, {
        method: 'POST',
        body: JSON.stringify({ handover_code: handoverInput.trim() }),
      });
      setSuccessMsg('Handover confirmed. Item marked Returned and finder appreciation points awarded!');
      await loadItemDetails();
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not verify handover code.');
    } finally {
      setActionLoading(false);
    }
  }

  const canManage = Boolean(item && currentUser && (item.is_owner || currentUser.role === 'admin'));
  const isOpenForClaims = item && ['Lost', 'Found', 'Verification Pending'].includes(item.status);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="item-detail-title"
    >
      <div className="w-full max-w-3xl bg-white border border-slate-200 rounded-xl my-6 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xs font-mono tabular-nums font-semibold text-slate-600">
              {item?.tracking_code || '...'}
            </span>
            {item && <StatusIndicator status={item.status} />}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close item details"
            className="p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 max-h-[80vh] overflow-y-auto space-y-6">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-500 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-blue-700" />
              <span className="text-sm">Loading item dossier...</span>
            </div>
          ) : error && !item ? (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
          ) : item ? (
            <>
              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-700">
                  {error}
                </div>
              )}
              {successMsg && (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800">
                  {successMsg}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                <div className="md:col-span-5">
                  <div className="rounded-lg overflow-hidden border border-slate-200">
                    <ItemPhoto
                      src={item.image_url}
                      alt={item.title}
                      category={item.category}
                      className="w-full h-56"
                    />
                  </div>
                </div>

                <div className="md:col-span-7 space-y-4">
                  <div>
                    <p className="text-xs font-medium text-slate-500">
                      {item.type === 'lost' ? 'Lost Item Report' : 'Found Item Registration'} · {item.category}
                    </p>
                    <h2 id="item-detail-title" className="text-xl font-bold text-slate-900 mt-1">
                      {item.title}
                    </h2>
                  </div>

                  <p className="text-sm text-slate-700 leading-relaxed">{item.description}</p>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 text-xs">
                    <div>
                      <span className="text-slate-500 block">Hostel Block &amp; Floor</span>
                      <span className="font-semibold text-slate-900 mt-0.5 block">
                        {item.block_name} · {item.floor}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Vicinity Landmark</span>
                      <span className="font-semibold text-slate-900 mt-0.5 inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{item.location_vicinity}</span>
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Date &amp; Time</span>
                      <span className="font-mono tabular-nums font-medium text-slate-900 mt-0.5 inline-flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>
                          {item.incident_date} · {item.incident_time}
                        </span>
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Reported By</span>
                      <span className="font-semibold text-slate-900 mt-0.5 block">
                        {item.reporter_name} ({item.reporter_badge})
                      </span>
                    </div>
                    {item.gps_lat != null && item.gps_lng != null && (
                      <div className="col-span-2">
                        <span className="text-slate-500 block">Item GPS Coordinates</span>
                        <span className="font-mono tabular-nums font-medium text-slate-900 mt-0.5 block">
                          {item.gps_lat.toFixed(6)}, {item.gps_lng.toFixed(6)}
                        </span>
                      </div>
                    )}
                  </div>

                  {item.gps_lat != null && item.gps_lng != null && (
                    <ItemPinPreviewMap
                      lat={item.gps_lat}
                      lng={item.gps_lng}
                      title={item.title}
                      isLost={item.type === 'lost'}
                    />
                  )}

                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
                    <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-slate-500" />
                      <span>Privacy &amp; Safe Handover Policy</span>
                    </div>
                    <p className="text-slate-600">{item.finder_contact_note}</p>
                  </div>
                </div>
              </div>

              {/* Hidden verification detail visible only to reporter or admin */}
              {canManage && item.secret_detail && (
                <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-xs space-y-1">
                  <div className="font-semibold text-amber-900">
                    Your Hidden Verification Clue (Not visible to claimants)
                  </div>
                  <p className="text-amber-800">{item.secret_detail}</p>
                </div>
              )}

              {/* Reporter / Admin Status Control & Claim Review */}
              {canManage && (
                <div className="pt-4 border-t border-slate-200 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-sm font-bold text-slate-900">Manage Report &amp; Claims</h3>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-600">Status:</label>
                      <select
                        disabled={actionLoading}
                        value={item.status}
                        onChange={(e) => handleStatusChange(e.target.value as ItemStatus)}
                        className="px-2.5 py-1.5 text-xs font-medium border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                      >
                        {ITEM_STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {claims.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      No verification requests received yet for this item.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {claims.map((claim) => (
                        <div key={claim.id} className="p-4 rounded-lg border border-slate-200 space-y-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-xs">
                              <span className="font-bold text-slate-900">{claim.claimant_name}</span>
                              <span className="text-slate-500">
                                {' '}
                                · {claim.claimant_student_id} · {claim.claimant_block_name}
                              </span>
                            </div>
                            <span className="text-xs font-semibold capitalize text-slate-700">
                              {claim.status}
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded border border-slate-200">
                            <span className="font-semibold text-slate-900 block mb-0.5">
                              Verification Answer:
                            </span>
                            {claim.verification_answer}
                          </p>
                          {claim.supporting_notes && (
                            <p className="text-xs text-slate-600">Notes: {claim.supporting_notes}</p>
                          )}
                          {claim.supporting_evidence_url && (
                            <a
                              href={claim.supporting_evidence_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-block text-xs font-medium text-blue-700 hover:underline"
                            >
                              View supporting evidence photo
                            </a>
                          )}

                          {claim.status === 'pending' && (
                            <div className="flex items-center gap-2 pt-1">
                              <button
                                type="button"
                                disabled={actionLoading}
                                onClick={() => handleReviewClaim(claim.id, 'approved')}
                                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg transition-colors"
                              >
                                Approve Ownership
                              </button>
                              <button
                                type="button"
                                disabled={actionLoading}
                                onClick={() => handleReviewClaim(claim.id, 'rejected')}
                                className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
                              >
                                Decline
                              </button>
                            </div>
                          )}

                          {claim.status === 'approved' && (
                            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 space-y-2">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-blue-900">
                                  Handover Confirmation Code:
                                </span>
                                <span className="font-mono font-bold text-blue-800 tracking-wider">
                                  {claim.handover_code}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={handoverInput}
                                  onChange={(e) => setHandoverInput(e.target.value)}
                                  placeholder="Enter code to confirm return"
                                  className="flex-1 px-2.5 py-1.5 text-xs font-mono bg-white border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                                />
                                <button
                                  type="button"
                                  disabled={actionLoading}
                                  onClick={() => handleCompleteHandover(claim.id)}
                                  className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
                                >
                                  Confirm Returned
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Claimant View for Non-Owners */}
              {!item.is_owner && (
                <div className="pt-4 border-t border-slate-200 space-y-4">
                  {userClaim ? (
                    <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 inline-flex items-center gap-1.5">
                          {userClaim.status === 'approved' || userClaim.status === 'completed' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                          ) : (
                            <Clock className="w-4 h-4 text-amber-700" />
                          )}
                          <span>Your Verification Status: {userClaim.status.toUpperCase()}</span>
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">
                        Your proof: &ldquo;{userClaim.verification_answer}&rdquo;
                      </p>
                      {userClaim.reviewer_notes && (
                        <p className="text-xs text-slate-700 font-medium">
                          Reviewer Note: {userClaim.reviewer_notes}
                        </p>
                      )}
                      {userClaim.status === 'approved' && (
                        <div className="p-3 rounded bg-emerald-50 border border-emerald-200 space-y-2 mt-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-emerald-900">
                              Your Handover Code (Share at {item.warden_desk}):
                            </span>
                            <span className="font-mono font-bold text-emerald-800">
                              {userClaim.handover_code}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={handoverInput}
                              onChange={(e) => setHandoverInput(e.target.value)}
                              placeholder="Enter code once item is in hand"
                              className="flex-1 px-2.5 py-1.5 text-xs font-mono bg-white border border-emerald-300 rounded-lg"
                            />
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() => handleCompleteHandover(userClaim.id)}
                              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg"
                            >
                              Mark Received
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : isOpenForClaims ? (
                    <form onSubmit={handleSubmitClaim} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-blue-700" />
                        <h3 className="text-sm font-bold text-slate-900">
                          {item.type === 'found'
                            ? 'Verify Ownership to Claim This Item'
                            : 'I Found This Belonging — Notify Owner'}
                        </h3>
                      </div>
                      <p className="text-xs text-slate-500">
                        {item.type === 'found'
                          ? 'Provide specific identifying details (serial number, stickers, inner contents, or markings) so the finder or warden can confirm you are the rightful owner.'
                          : 'Describe where you secured the item and one identifying mark so the owner can confirm.'}
                      </p>

                      <textarea
                        rows={3}
                        required
                        value={verificationAnswer}
                        onChange={(e) => setVerificationAnswer(e.target.value)}
                        placeholder="Describe unique identifying marks, contents, or proof of ownership..."
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={supportingNotes}
                          onChange={(e) => setSupportingNotes(e.target.value)}
                          placeholder="Optional note (e.g. can show purchase bill)"
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                        <label className="flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer">
                          {uploadingEvidence ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-700" />
                          ) : (
                            <Upload className="w-3.5 h-3.5 text-slate-500" />
                          )}
                          <span>{evidenceUrl ? 'Evidence attached' : 'Attach proof photo (optional)'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            onChange={handleEvidenceUpload}
                          />
                        </label>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            if (!currentUser) {
                              onRequireAuth();
                              return;
                            }
                            onOpenComplaint(item);
                          }}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800"
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Report issue / dispute</span>
                        </button>

                        <button
                          type="submit"
                          disabled={submittingClaim || uploadingEvidence}
                          className="px-4 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-2"
                        >
                          {submittingClaim && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          <span>
                            {currentUser
                              ? item.type === 'found'
                                ? 'Submit Ownership Proof'
                                : 'Send Found Confirmation'
                              : 'Sign In to Verify'}
                          </span>
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>This report is currently {item.status} and closed to new claims.</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (!currentUser) {
                            onRequireAuth();
                            return;
                          }
                          onOpenComplaint(item);
                        }}
                        className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 font-medium"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Report dispute</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
