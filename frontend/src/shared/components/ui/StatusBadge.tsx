import React, { type ReactNode } from 'react';

export type StatusTone =
  | 'idle'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'running'
  | 'closed'
  | 'draft'
  | 'pending'
  | 'error'
  | 'active';

interface StatusBadgeProps {
  children: ReactNode;
  tone?: StatusTone;
  className?: string;
}

const TONE_MAP: Record<StatusTone, string> = {
  idle: 'border-slate-200 bg-slate-100 text-slate-600',
  draft: 'border-slate-200 bg-slate-100 text-slate-600',
  closed: 'border-slate-200 bg-slate-100 text-slate-500',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  active: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  pending: 'border-amber-200 bg-amber-50 text-amber-700',
  danger: 'border-red-200 bg-red-50 text-red-700',
  error: 'border-red-200 bg-red-50 text-red-700',
  info: 'border-blue-200 bg-blue-50 text-blue-700',
  running: 'border-indigo-200 bg-indigo-50 text-indigo-700',
};

export function StatusBadge({ children, tone = 'idle', className = '' }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${TONE_MAP[tone]} ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" aria-hidden="true" />
      {children}
    </span>
  );
}
