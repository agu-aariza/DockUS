import React, { type ReactNode } from 'react';
import { StatusBadge, type StatusTone } from './StatusBadge';

export interface OperationItemData {
  id: string;
  title: string;
  description?: string;
  timestamp?: string;
  status?: StatusTone;
  statusLabel?: string;
  icon?: ReactNode;
  meta?: ReactNode;
}

interface OperationPanelProps {
  items: OperationItemData[];
  title?: string;
  emptyMessage?: string;
  className?: string;
}

export function OperationPanel({
  items,
  title,
  emptyMessage = 'No hay actividad reciente.',
  className = '',
}: OperationPanelProps) {
  return (
    <div className={`rounded-lg border border-app-border bg-white ${className}`}>
      {title && (
        <div className="border-b border-app-border px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        </div>
      )}
      <div className="divide-y divide-slate-100">
        {items.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-slate-500">{emptyMessage}</div>
        ) : (
          items.map((item) => <OperationItem key={item.id} data={item} />)
        )}
      </div>
    </div>
  );
}

interface OperationItemProps {
  data: OperationItemData;
}

export function OperationItem({ data }: OperationItemProps) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-slate-50">
      {data.icon && (
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500">
          {data.icon}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-slate-900 truncate">{data.title}</p>
          {data.status && data.statusLabel && (
            <StatusBadge tone={data.status} className="shrink-0">
              {data.statusLabel}
            </StatusBadge>
          )}
        </div>
        {data.description && (
          <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{data.description}</p>
        )}
        {(data.timestamp || data.meta) && (
          <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-400">
            {data.timestamp && <span>{data.timestamp}</span>}
            {data.meta && <span className="truncate">{data.meta}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

interface ActivityFeedProps {
  items: OperationItemData[];
  title?: string;
  emptyMessage?: string;
  className?: string;
}

export function ActivityFeed({
  items,
  title = 'Actividad reciente',
  emptyMessage = 'No hay actividad reciente.',
  className = '',
}: ActivityFeedProps) {
  return (
    <OperationPanel
      items={items}
      title={title}
      emptyMessage={emptyMessage}
      className={className}
    />
  );
}
