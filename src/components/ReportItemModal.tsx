import { Crosshair, Loader2, ShieldAlert, Upload, X } from 'lucide-react';
import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { apiRequest, uploadImageFile } from '../lib/api';
import { ITEM_CATEGORIES, type HostelBlock, type ItemCategory, type ItemRecord, type ItemType } from '../types';
import { ItemGpsPickerMap } from './ItemMapComponents';

interface ReportItemModalProps {
  isOpen: boolean;
  defaultType?: ItemType;
  blocks: HostelBlock[];
  defaultBlockId?: number | null;
  onClose: () => void;
  onCreated: (item: ItemRecord) => void;
}

export function ReportItemModal({
  isOpen,
  defaultType = 'lost',
  blocks,
  defaultBlockId,
  onClose,
  onCreated,
}: ReportItemModalProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [type, setType] = useState<ItemType>(defaultType);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ItemCategory>('Electronics');
  const [blockId, setBlockId] = useState<string>(
    defaultBlockId ? String(defaultBlockId) : blocks[0] ? String(blocks[0].id) : '1'
  );
  const [floor, setFloor] = useState('Ground Floor');
  const [locationVicinity, setLocationVicinity] = useState('');
  const [incidentDate, setIncidentDate] = useState(today);
  const [incidentTime, setIncidentTime] = useState('14:00');
  const [description, setDescription] = useState('');
  const [secretDetail, setSecretDetail] = useState('');
  const [finderContactNote, setFinderContactNote] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [locatingGps, setLocatingGps] = useState(false);
  const [error, setError] = useState('');

  const initialBlock = blocks.find((b) => String(b.id) === blockId) || blocks[0];
  const [gpsLat, setGpsLat] = useState<number>(initialBlock?.gps_lat ?? 13.0071);
  const [gpsLng, setGpsLng] = useState<number>(initialBlock?.gps_lng ?? 80.2377);

  useEffect(() => {
    if (isOpen) {
      setType(defaultType);
      const nextBlockId = defaultBlockId
        ? String(defaultBlockId)
        : blocks[0]
          ? String(blocks[0].id)
          : '1';
      setBlockId(nextBlockId);
      const blk = blocks.find((b) => String(b.id) === nextBlockId) || blocks[0];
      if (blk) {
        setGpsLat(blk.gps_lat);
        setGpsLng(blk.gps_lng);
      }
    }
  }, [isOpen, defaultType, defaultBlockId, blocks]);

  if (!isOpen) return null;

  function handleBlockChange(nextId: string) {
    setBlockId(nextId);
    const blk = blocks.find((b) => String(b.id) === nextId);
    if (blk) {
      setGpsLat(blk.gps_lat);
      setGpsLng(blk.gps_lng);
    }
  }

  function handleCaptureCurrentGps() {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported in this browser. Click the map or enter coordinates manually.');
      return;
    }
    setError('');
    setLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLat(Number(pos.coords.latitude.toFixed(6)));
        setGpsLng(Number(pos.coords.longitude.toFixed(6)));
        setLocatingGps(false);
      },
      () => {
        setError('Could not read device GPS permission. Click on the map pin or enter coordinates manually.');
        setLocatingGps(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setUploadingImage(true);
    try {
      const url = await uploadImageFile(file);
      setImageUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Photo upload failed.');
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (title.trim().length < 3) {
      setError('Please enter a descriptive item name (at least 3 characters).');
      return;
    }
    if (locationVicinity.trim().length < 3) {
      setError('Please specify the hostel vicinity or landmark (e.g. 2nd Floor Water Cooler).');
      return;
    }
    if (description.trim().length < 10) {
      setError('Please provide a clear description (at least 10 characters).');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiRequest<{ item: ItemRecord }>('/api/items', {
        method: 'POST',
        body: JSON.stringify({
          type,
          title: title.trim(),
          category,
          description: description.trim(),
          secret_detail: secretDetail.trim(),
          image_url: imageUrl,
          block_id: Number(blockId),
          floor,
          location_vicinity: locationVicinity.trim(),
          gps_lat: gpsLat,
          gps_lng: gpsLng,
          incident_date: incidentDate,
          incident_time: incidentTime,
          finder_contact_note: finderContactNote.trim(),
        }),
      });
      onCreated(res.item);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit report.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-item-title"
    >
      <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-xl my-8 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 id="report-item-title" className="text-lg font-bold text-slate-900">
              {type === 'lost' ? 'Report a Lost Belonging' : 'Register a Found Item'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              DormFind automatically checks for potential matches across hostel blocks.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close report modal"
            className="p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[78vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setType('lost')}
              className={`py-2 text-xs font-semibold rounded-md transition-colors ${
                type === 'lost' ? 'bg-white text-red-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              I Lost an Item
            </button>
            <button
              type="button"
              onClick={() => setType('found')}
              className={`py-2 text-xs font-semibold rounded-md transition-colors ${
                type === 'found' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              I Found an Item (+10 pts)
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Item Name</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Black Casio Calculator"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ItemCategory)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {ITEM_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Hostel Block</label>
              <select
                value={blockId}
                onChange={(e) => handleBlockChange(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {blocks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Floor</label>
              <select
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="Ground Floor">Ground Floor</option>
                <option value="1st Floor">1st Floor</option>
                <option value="2nd Floor">2nd Floor</option>
                <option value="3rd Floor">3rd Floor</option>
                <option value="4th Floor">4th Floor</option>
                <option value="5th Floor">5th Floor</option>
                <option value="Outdoor Courtyard">Outdoor Courtyard</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {type === 'lost' ? 'Last-Known Vicinity' : 'Discovery Spot'}
              </label>
              <input
                type="text"
                required
                value={locationVicinity}
                onChange={(e) => setLocationVicinity(e.target.value)}
                placeholder="e.g. Reading Room Table 3"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {type === 'lost' ? 'Date Lost' : 'Date Found'}
              </label>
              <input
                type="date"
                required
                max={today}
                value={incidentDate}
                onChange={(e) => setIncidentDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Approximate Time</label>
              <input
                type="time"
                required
                value={incidentTime}
                onChange={(e) => setIncidentTime(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="block text-xs font-semibold text-slate-900">
                  Item GPS Coordinates (Click map or capture spot)
                </span>
                <span className="text-[11px] text-slate-500">
                  Records only where this belonging was lost or found — never tracks your live location.
                </span>
              </div>
              <button
                type="button"
                disabled={locatingGps}
                onClick={handleCaptureCurrentGps}
                className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-xs font-semibold text-slate-800 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                {locatingGps ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-700" />
                ) : (
                  <Crosshair className="w-3.5 h-3.5 text-blue-700" />
                )}
                <span>Use Spot GPS</span>
              </button>
            </div>

            <ItemGpsPickerMap
              lat={gpsLat}
              lng={gpsLng}
              onChange={(nextLat, nextLng) => {
                setGpsLat(nextLat);
                setGpsLng(nextLng);
              }}
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Latitude</label>
                <input
                  type="number"
                  step="0.000001"
                  value={gpsLat}
                  onChange={(e) => setGpsLat(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Longitude</label>
                <input
                  type="number"
                  step="0.000001"
                  value={gpsLng}
                  onChange={(e) => setGpsLng(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Public Description</label>
            <textarea
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe color, brand, size, or general condition without giving away secret identifying marks."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
              <div>
                <label className="block text-xs font-semibold text-slate-900">
                  Private Verification Detail (Hidden from Public)
                </label>
                <p className="text-[11px] text-slate-500">
                  {type === 'found'
                    ? 'Enter a detail only the true owner would know (e.g. initials inside, sticker, lock-screen photo). Used to prevent false claims.'
                    : 'Optional private marker you can check against a finder’s report.'}
                </p>
              </div>
            </div>
            <input
              type="text"
              value={secretDetail}
              onChange={(e) => setSecretDetail(e.target.value)}
              placeholder="e.g. Green sticker inside battery cover / student library card ending 449"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Item Photograph (Optional)
              </label>
              <label className="flex items-center justify-center gap-2 px-3 py-2.5 border border-dashed border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors">
                {uploadingImage ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-blue-700" />
                    <span>Compressing &amp; uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 text-slate-500" />
                    <span>{imageUrl ? 'Replace photo' : 'Upload JPEG / PNG / WebP'}</span>
                  </>
                )}
                <input type="file" accept="image/*" className="sr-only" onChange={handleFileChange} />
              </label>
              {imageUrl && (
                <div className="mt-2 flex items-center gap-2">
                  <img
                    src={imageUrl}
                    alt="Uploaded item preview"
                    className="w-14 h-10 object-cover rounded border border-slate-200"
                  />
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Remove photo
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Handover Note (Shown only after verification)
              </label>
              <input
                type="text"
                value={finderContactNote}
                onChange={(e) => setFinderContactNote(e.target.value)}
                placeholder="e.g. Left at Aryabhata Lobby Desk"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || uploadingImage}
              className="px-5 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{type === 'lost' ? 'Publish Lost Report' : 'Register Found Item'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
