import {
  AlertCircle,
  Archive,
  CheckCircle2,
  Clock,
  Eye,
  PackageCheck,
  PackageSearch,
} from 'lucide-react';
import { useState } from 'react';
import type { ItemCategory, ItemStatus } from '../types';

export function StatusIndicator({ status }: { status: ItemStatus }) {
  switch (status) {
    case 'Lost':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 whitespace-nowrap">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>Lost</span>
        </span>
      );
    case 'Found':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-700 whitespace-nowrap">
          <Eye className="w-3.5 h-3.5 shrink-0" />
          <span>Found</span>
        </span>
      );
    case 'Verification Pending':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>Verification Pending</span>
        </span>
      );
    case 'Claimed':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 whitespace-nowrap">
          <PackageCheck className="w-3.5 h-3.5 shrink-0" />
          <span>Claimed</span>
        </span>
      );
    case 'Returned':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>Returned</span>
        </span>
      );
    case 'Closed':
    default:
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 whitespace-nowrap">
          <Archive className="w-3.5 h-3.5 shrink-0" />
          <span>Closed</span>
        </span>
      );
  }
}

export function ItemPhoto({
  src,
  alt,
  category,
  className = 'w-full h-44',
}: {
  src?: string;
  alt: string;
  category: ItemCategory | string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`${className} bg-slate-100 border-b border-slate-200 flex flex-col items-center justify-center px-4 text-center select-none`}
      >
        <PackageSearch className="w-7 h-7 text-slate-400 mb-1.5" />
        <span className="text-xs font-medium text-slate-500 line-clamp-1">{category}</span>
        <span className="text-[11px] text-slate-400 mt-0.5">No photograph attached</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${className} object-cover bg-slate-100`}
    />
  );
}
