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

export interface StatusBadgeProps {
  children: ReactNode;
  tone?: StatusTone;
  icon?: ReactNode;
  size?: 'sm' | 'md';
  className?: string;
}

// Los tonos numerados (`success-50`, `danger-200`...) no responden al tema
// (ver el porqué en styles.css); son pastel y casi invisibles sobre una
// superficie oscura, así que aquí sí hace falta un `dark:` explícito por tono
// en vez de depender del token — este componente lo usan 25 ficheros.
const TONE_MAP: Record<StatusTone, string> = {
  idle: 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300',
  draft: 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300',
  closed: 'border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-400',
  success: 'border-success-200 bg-success-50 text-success-700 dark:border-success-800 dark:bg-success-950 dark:text-success-400',
  active: 'border-success-200 bg-success-50 text-success-700 dark:border-success-800 dark:bg-success-950 dark:text-success-400',
  warning: 'border-warning-200 bg-warning-50 text-warning-700 dark:border-warning-800 dark:bg-warning-950 dark:text-warning-400',
  pending: 'border-warning-200 bg-warning-50 text-warning-700 dark:border-warning-800 dark:bg-warning-950 dark:text-warning-400',
  danger: 'border-danger-200 bg-danger-50 text-danger-700 dark:border-danger-800 dark:bg-danger-950 dark:text-danger-400',
  error: 'border-danger-200 bg-danger-50 text-danger-700 dark:border-danger-800 dark:bg-danger-950 dark:text-danger-400',
  info: 'border-primary-200 bg-primary-50 text-primary-700 dark:border-primary-800 dark:bg-primary-950 dark:text-primary-400',
  running: 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-400',
};

const SIZE_MAP: Record<NonNullable<StatusBadgeProps['size']>, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
};

export function StatusBadge({
  children,
  tone = 'idle',
  icon,
  size = 'sm',
  className = '',
}: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${TONE_MAP[tone]} ${SIZE_MAP[size]} ${className}`}
    >
      {icon ? (
        <span className="text-sm">{icon}</span>
      ) : (
        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" aria-hidden="true" />
      )}
      {children}
    </span>
  );
}
