import { Calendar, MapPin } from 'lucide-react';
import type { ItemRecord } from '../types';
import { ItemPhoto, StatusIndicator } from './StatusBadge';

export function ItemCard({
  item,
  onSelect,
}: {
  item: ItemRecord;
  onSelect: (itemId: number) => void;
}) {
  return (
    <article className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-slate-300 transition-colors flex flex-col">
      <button
        type="button"
        onClick={() => onSelect(item.id)}
        className="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 flex flex-col flex-1"
      >
        <div className="w-full h-44 overflow-hidden bg-slate-100">
          <ItemPhoto src={item.image_url} alt={item.title} category={item.category} className="w-full h-44" />
        </div>

        <div className="p-4 flex flex-col flex-1 justify-between gap-3 w-full">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <StatusIndicator status={item.status} />
              <span className="text-xs font-mono tabular-nums text-slate-500">{item.tracking_code}</span>
            </div>

            <h3 className="text-[15px] font-semibold text-slate-900 leading-snug line-clamp-1">
              {item.title}
            </h3>

            <div className="flex items-center gap-1.5 text-xs text-slate-500 flex-wrap">
              <span>{item.category}</span>
              <span aria-hidden="true">·</span>
              <span>{item.block_name}</span>
            </div>

            <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed pt-0.5">
              {item.description}
            </p>
          </div>

          <div className="pt-2.5 border-t border-slate-100 space-y-1 text-xs text-slate-500">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 truncate">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{item.location_vicinity}</span>
              </span>
              <span className="inline-flex items-center gap-1 font-mono tabular-nums shrink-0">
                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{item.incident_date}</span>
              </span>
            </div>
            {item.gps_lat != null && item.gps_lng != null && (
              <div className="text-[11px] font-mono tabular-nums text-slate-400">
                GPS: {item.gps_lat.toFixed(5)}, {item.gps_lng.toFixed(5)}
              </div>
            )}
          </div>
        </div>
      </button>
    </article>
  );
}
