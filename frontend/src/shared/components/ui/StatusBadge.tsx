/**
 * @fileoverview Componente UI base del sistema de diseño EduCodeAI (StatusBadge).
 *
 * @module StatusBadge
 */

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

// Tag institucional: hairline + marca vertical, no la píldora pastel con
// punto de cualquier dashboard genérico. El color vive en el borde, la marca
// y el texto — nunca en un relleno saturado — y la tipografía es la misma
// mono en versalitas que `.ui-label`/`.institutional-line` en el resto de la
// app, para que un estado se lea como parte de esta interfaz y no de una
// plantilla. Los tonos numerados (`success-200`, `danger-800`...) no
// responden al tema (ver el porqué en styles.css), de ahí el `dark:`
// explícito por tono — este componente lo usan 25 ficheros.
const TONE_MAP: Record<StatusTone, string> = {
  idle: 'border-app-border text-app-text-secondary',
  draft: 'border-app-border text-app-text-secondary',
  closed: 'border-app-border text-app-text-muted',
  success: 'border-success-200 text-success-700 dark:border-success-800 dark:text-success-400',
  active: 'border-success-200 text-success-700 dark:border-success-800 dark:text-success-400',
  warning: 'border-warning-200 text-warning-700 dark:border-warning-800 dark:text-warning-400',
  pending: 'border-warning-200 text-warning-700 dark:border-warning-800 dark:text-warning-400',
  danger: 'border-danger-200 text-danger-700 dark:border-danger-800 dark:text-danger-400',
  error: 'border-danger-200 text-danger-700 dark:border-danger-800 dark:text-danger-400',
  info: 'border-primary/30 text-primary',
  running: 'border-indigo-200 text-indigo-700 dark:border-indigo-800 dark:text-indigo-400',
};

const SIZE_MAP: Record<NonNullable<StatusBadgeProps['size']>, string> = {
  sm: 'px-2 py-1 text-[10px]',
  md: 'px-2.5 py-1 text-[11px]',
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
      className={`inline-flex items-center gap-1.5 rounded border bg-app-bg-subtle font-mono font-semibold uppercase tracking-[0.1em] ${TONE_MAP[tone]} ${SIZE_MAP[size]} ${className}`}
    >
      {icon ? (
        <span className="text-sm normal-case tracking-normal">{icon}</span>
      ) : (
        <span className="h-2.5 w-0.5 shrink-0 rounded-full bg-current" aria-hidden="true" />
      )}
      {children}
    </span>
  );
}
