import {
  AdvancedMarker,
  APIProvider,
  InfoWindow,
  Map as GoogleMap,
  type MapMouseEvent,
  Pin,
  useAdvancedMarkerRef,
} from '@vis.gl/react-google-maps';
import { useCallback, useState } from 'react';
import type { HostelBlock, ItemRecord } from '../types';

export const MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) || '';

const DEFAULT_CAMPUS_CENTER = { lat: 13.0071, lng: 80.2377 };

function ItemPinWithInfo({
  item,
  onOpenItem,
}: {
  item: ItemRecord;
  onOpenItem: (itemId: number) => void;
}) {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [open, setOpen] = useState(false);

  if (item.gps_lat == null || item.gps_lng == null) return null;

  const isLost = item.type === 'lost';
  const isReturned = item.status === 'Returned' || item.status === 'Closed';
  const pinColor = isReturned ? '#16a34a' : isLost ? '#dc2626' : '#0284c7';
  const borderColor = isReturned ? '#14532d' : isLost ? '#991b1b' : '#075985';

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: item.gps_lat, lng: item.gps_lng }}
        title={`${item.tracking_code}: ${item.title}`}
        onClick={() => setOpen(true)}
      >
        <Pin background={pinColor} borderColor={borderColor} glyphColor="#ffffff" scale={0.95} />
      </AdvancedMarker>

      {open && marker && (
        <InfoWindow anchor={marker} maxWidth={240} onCloseClick={() => setOpen(false)}>
          <div className="p-1 space-y-1.5 text-slate-900">
            <div className="text-[11px] font-mono font-semibold text-slate-500">
              {item.tracking_code} · {item.status}
            </div>
            <div className="text-xs font-bold leading-snug">{item.title}</div>
            <div className="text-[11px] text-slate-600">
              {item.block_name} · {item.location_vicinity}
            </div>
            <div className="text-[11px] font-mono text-slate-500">
              {item.gps_lat.toFixed(5)}, {item.gps_lng.toFixed(5)}
            </div>
            <button
              type="button"
              onClick={() => onOpenItem(item.id)}
              className="mt-1 px-2.5 py-1 bg-blue-700 text-white text-[11px] font-semibold rounded"
            >
              Open Item Dossier
            </button>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

export function CampusItemsGoogleMap({
  blocks,
  items,
  selectedBlockId,
  onSelectBlock,
  onOpenItem,
}: {
  blocks: HostelBlock[];
  items: ItemRecord[];
  selectedBlockId: number | null;
  onSelectBlock: (blockId: number) => void;
  onOpenItem: (itemId: number) => void;
}) {
  const activeBlock = blocks.find((b) => b.id === selectedBlockId);
  const itemsWithGps = items.filter((i) => i.gps_lat != null && i.gps_lng != null);

  if (!MAPS_API_KEY) {
    return (
      <div className="w-full h-[380px] bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
        <svg
          viewBox="0 0 570 400"
          className="w-full h-full block"
          role="img"
          aria-label="Hostel blocks A through F campus map"
        >
          <rect x="0" y="0" width="570" height="400" fill="#f8fafc" />
          <line x1="130" y1="95" x2="440" y2="95" stroke="#e2e8f0" strokeWidth="14" strokeLinecap="round" />
          <line x1="130" y1="300" x2="440" y2="300" stroke="#e2e8f0" strokeWidth="14" strokeLinecap="round" />
          <line x1="130" y1="95" x2="130" y2="300" stroke="#e2e8f0" strokeWidth="14" strokeLinecap="round" />
          <line x1="285" y1="95" x2="285" y2="300" stroke="#e2e8f0" strokeWidth="14" strokeLinecap="round" />
          <line x1="440" y1="95" x2="440" y2="300" stroke="#e2e8f0" strokeWidth="14" strokeLinecap="round" />
          {blocks.map((block) => {
            const isSelected = activeBlock?.id === block.id;
            const openCount = (block.lost_count || 0) + (block.found_count || 0);
            return (
              <g
                key={block.id}
                transform={`translate(${block.map_x}, ${block.map_y})`}
                onClick={() => onSelectBlock(block.id)}
                className="cursor-pointer"
              >
                <rect
                  x="-64"
                  y="-40"
                  width="128"
                  height="80"
                  rx="10"
                  fill={isSelected ? '#1d4ed8' : '#ffffff'}
                  stroke={isSelected ? '#1e40af' : '#cbd5e1'}
                  strokeWidth={isSelected ? '2' : '1.5'}
                />
                <text
                  x="0"
                  y="-14"
                  textAnchor="middle"
                  fill={isSelected ? '#dbeafe' : '#64748b'}
                  fontSize="10"
                  fontWeight="600"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {block.code}
                </text>
                <text
                  x="0"
                  y="4"
                  textAnchor="middle"
                  fill={isSelected ? '#ffffff' : '#0f172a'}
                  fontSize="13"
                  fontWeight="700"
                >
                  {block.name}
                </text>
                <text
                  x="0"
                  y="22"
                  textAnchor="middle"
                  fill={isSelected ? '#eff6ff' : '#475569'}
                  fontSize="10"
                >
                  {openCount} active
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  return (
    <div className="w-full h-[380px] rounded-lg overflow-hidden border border-slate-200">
      <APIProvider apiKey={MAPS_API_KEY} libraries={['marker']}>
        <GoogleMap
          mapId="DEMO_MAP_ID"
          defaultCenter={DEFAULT_CAMPUS_CENTER}
          defaultZoom={17}
          gestureHandling="greedy"
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          style={{ width: '100%', height: '100%' }}
        >
          {/* Hostel Block A-F Markers */}
          {blocks.map((block) => {
            const isSelected = activeBlock?.id === block.id;
            const letter = block.name.replace('Block ', '').slice(0, 1);
            return (
              <AdvancedMarker
                key={block.id}
                position={{ lat: block.gps_lat, lng: block.gps_lng }}
                title={`${block.name} — ${block.warden_desk}`}
                onClick={() => onSelectBlock(block.id)}
              >
                <Pin
                  background={isSelected ? '#1d4ed8' : '#0f172a'}
                  borderColor={isSelected ? '#1e3a8a' : '#334155'}
                  glyphColor="#ffffff"
                  glyphText={letter}
                  scale={isSelected ? 1.2 : 1.05}
                />
              </AdvancedMarker>
            );
          })}

          {/* Lost & Found Item GPS Markers */}
          {itemsWithGps.map((item) => (
            <ItemPinWithInfo key={item.id} item={item} onOpenItem={onOpenItem} />
          ))}
        </GoogleMap>
      </APIProvider>
    </div>
  );
}

export function ItemGpsPickerMap({
  lat,
  lng,
  onChange,
}: {
  lat: number;
  lng: number;
  onChange: (nextLat: number, nextLng: number) => void;
}) {
  const handleMapClick = useCallback(
    (ev: MapMouseEvent) => {
      if (ev.detail.latLng) {
        onChange(
          Number(ev.detail.latLng.lat.toFixed(6)),
          Number(ev.detail.latLng.lng.toFixed(6))
        );
      }
    },
    [onChange]
  );

  if (!MAPS_API_KEY) {
    return null;
  }

  return (
    <div className="w-full h-52 rounded-lg overflow-hidden border border-slate-200">
      <APIProvider apiKey={MAPS_API_KEY} libraries={['marker']}>
        <GoogleMap
          mapId="DEMO_MAP_ID"
          center={{ lat, lng }}
          defaultZoom={17}
          gestureHandling="greedy"
          onClick={handleMapClick}
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          style={{ width: '100%', height: '100%' }}
        >
          <AdvancedMarker position={{ lat, lng }} title="Selected item GPS spot">
            <Pin background="#1d4ed8" borderColor="#1e3a8a" glyphColor="#ffffff" scale={1.1} />
          </AdvancedMarker>
        </GoogleMap>
      </APIProvider>
    </div>
  );
}

export function ItemPinPreviewMap({
  lat,
  lng,
  title,
  isLost,
}: {
  lat: number;
  lng: number;
  title: string;
  isLost: boolean;
}) {
  if (!MAPS_API_KEY) {
    return null;
  }

  return (
    <div className="w-full h-48 rounded-lg overflow-hidden border border-slate-200">
      <APIProvider apiKey={MAPS_API_KEY} libraries={['marker']}>
        <GoogleMap
          mapId="DEMO_MAP_ID"
          defaultCenter={{ lat, lng }}
          defaultZoom={18}
          gestureHandling="cooperative"
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          style={{ width: '100%', height: '100%' }}
        >
          <AdvancedMarker position={{ lat, lng }} title={title}>
            <Pin
              background={isLost ? '#dc2626' : '#0284c7'}
              borderColor={isLost ? '#991b1b' : '#075985'}
              glyphColor="#ffffff"
            />
          </AdvancedMarker>
        </GoogleMap>
      </APIProvider>
    </div>
  );
}
