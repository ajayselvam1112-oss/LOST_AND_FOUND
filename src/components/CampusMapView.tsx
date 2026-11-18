import { AlertCircle, Building2, CheckCircle2, Eye, MapPin, Plus } from 'lucide-react';
import type { HostelBlock, ItemRecord } from '../types';
import { CampusItemsGoogleMap } from './ItemMapComponents';

interface CampusMapViewProps {
  blocks: HostelBlock[];
  items: ItemRecord[];
  selectedBlockId: number | null;
  onSelectBlock: (blockId: number) => void;
  onBrowseBlockItems: (blockId: number) => void;
  onReportInBlock: (blockId: number) => void;
  onOpenItem: (itemId: number) => void;
}

export function CampusMapView({
  blocks,
  items,
  selectedBlockId,
  onSelectBlock,
  onBrowseBlockItems,
  onReportInBlock,
  onOpenItem,
}: CampusMapViewProps) {
  const activeBlock = blocks.find((b) => b.id === selectedBlockId) || blocks[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Hostel Blocks (A–F) &amp; Item GPS Map
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Inspect lost and found GPS pins for belongings across Blocks A through F and locate official Warden Desks.
            Private student live locations are never tracked.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Interactive Google Map with Blocks A-F and Item GPS Pins */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-900">Campus GPS Map — Blocks A to F</h2>
            <div className="flex items-center gap-3 text-[11px] text-slate-600">
              <span>Black/Blue Pin: Block A–F</span>
              <span aria-hidden="true">·</span>
              <span className="text-red-700 font-medium">Red Pin: Lost Item</span>
              <span aria-hidden="true">·</span>
              <span className="text-sky-700 font-medium">Sky Pin: Found Item</span>
            </div>
          </div>

          <CampusItemsGoogleMap
            blocks={blocks}
            items={items}
            selectedBlockId={selectedBlockId}
            onSelectBlock={onSelectBlock}
            onOpenItem={onOpenItem}
          />
        </div>

        {/* Selected Block Details */}
        {activeBlock && (
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between gap-5">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-xs font-mono font-semibold text-blue-700">
                    {activeBlock.code} · {activeBlock.wing}
                  </span>
                  <h2 className="text-xl font-bold text-slate-900 mt-1">{activeBlock.name}</h2>
                </div>
                <Building2 className="w-5 h-5 text-slate-400 shrink-0" />
              </div>

              <p className="text-sm text-slate-600 leading-relaxed">{activeBlock.description}</p>

              <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-100">
                <div>
                  <span className="text-xs text-slate-500 block">Lost</span>
                  <span className="text-lg font-bold font-mono tabular-nums text-red-700">
                    {activeBlock.lost_count || 0}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block">Found</span>
                  <span className="text-lg font-bold font-mono tabular-nums text-sky-700">
                    {activeBlock.found_count || 0}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block">Returned</span>
                  <span className="text-lg font-bold font-mono tabular-nums text-emerald-700">
                    {activeBlock.returned_count || 0}
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
                <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-blue-700" />
                  <span>Official Drop-off &amp; Handover Desk</span>
                </div>
                <p className="text-slate-700">{activeBlock.warden_desk}</p>
                <p className="text-slate-500">
                  Block Warden: {activeBlock.warden_name} · {activeBlock.total_floors} Floors
                </p>
                <p className="font-mono tabular-nums text-[11px] text-slate-500">
                  Block GPS: {activeBlock.gps_lat.toFixed(5)}, {activeBlock.gps_lng.toFixed(5)}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => onBrowseBlockItems(activeBlock.id)}
                className="flex-1 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
              >
                Browse {activeBlock.name} Items
              </button>
              <button
                type="button"
                onClick={() => onReportInBlock(activeBlock.id)}
                className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Report Here</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Block Directory Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200">
          <h3 className="text-sm font-bold text-slate-900">Hostel Blocks A–F Directory</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 bg-slate-50">
                <th className="py-2.5 px-4">Block</th>
                <th className="py-2.5 px-4">Wing</th>
                <th className="py-2.5 px-4">Warden Desk</th>
                <th className="py-2.5 px-4">Block GPS</th>
                <th className="py-2.5 px-4 text-right">Lost</th>
                <th className="py-2.5 px-4 text-right">Found</th>
                <th className="py-2.5 px-4 text-right">Returned</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {blocks.map((b) => (
                <tr
                  key={b.id}
                  onClick={() => onSelectBlock(b.id)}
                  className={`cursor-pointer transition-colors ${
                    activeBlock?.id === b.id ? 'bg-blue-50/50' : 'hover:bg-slate-50'
                  }`}
                >
                  <td className="py-3 px-4 font-semibold text-slate-900">
                    <span className="font-mono text-slate-500 mr-2">{b.code}</span>
                    {b.name}
                  </td>
                  <td className="py-3 px-4 text-slate-600">{b.wing}</td>
                  <td className="py-3 px-4 text-slate-600">{b.warden_desk}</td>
                  <td className="py-3 px-4 font-mono tabular-nums text-slate-500">
                    {b.gps_lat.toFixed(4)}, {b.gps_lng.toFixed(4)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-red-700 font-semibold">
                    <span className="inline-flex items-center gap-1 justify-end">
                      <AlertCircle className="w-3 h-3" />
                      {b.lost_count || 0}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-sky-700 font-semibold">
                    <span className="inline-flex items-center gap-1 justify-end">
                      <Eye className="w-3 h-3" />
                      {b.found_count || 0}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-700 font-semibold">
                    <span className="inline-flex items-center gap-1 justify-end">
                      <CheckCircle2 className="w-3 h-3" />
                      {b.returned_count || 0}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onBrowseBlockItems(b.id);
                      }}
                      className="text-blue-700 hover:text-blue-900 font-semibold hover:underline"
                    >
                      View Items
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
