import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  headerAction?: ReactNode;
}

export function Card({ children, className = "", title, headerAction }: CardProps) {
  return (
    <article className={`rounded-2xl border border-academic-outline/20 bg-white shadow-academic ${className}`}>
      {(title || headerAction) && (
        <div className="flex flex-col gap-3 border-b border-academic-outline/20 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          {title && (
            <h4 className="text-sm font-semibold tracking-tight text-academic-on-surface">
              {title}
            </h4>
          )}
          {headerAction}
        </div>
      )}
      <div className="space-y-4 p-5">{children}</div>
    </article>
  );
}

interface BadgeProps {
  children: ReactNode;
  variant?: "idle" | "success" | "warning" | "danger";
}

const BADGE_STYLES = {
  idle: "border-academic-outline-variant bg-academic-surface-container-low text-academic-on-surface-variant",
  success: "border-emerald-600/20 bg-emerald-50 text-emerald-700",
  warning: "border-amber-600/20 bg-amber-50 text-amber-700",
  danger: "border-academic-error/20 bg-academic-error-container/40 text-academic-on-error-container",
} as const;

export function Badge({ children, variant = "idle" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-mono uppercase font-bold tracking-wider ${BADGE_STYLES[variant]}`}
    >
      {children}
    </span>
  );
}
