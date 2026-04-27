import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  headerAction?: ReactNode;
}

export function Card({ children, className = "", title, headerAction }: CardProps) {
  return (
    <article className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {(title || headerAction) && (
        <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          {title && (
            <h4 className="text-sm font-semibold tracking-tight text-slate-900">
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
  idle: "border-slate-200 bg-slate-100 text-slate-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  danger: "border-rose-200 bg-rose-50 text-rose-700",
} as const;

export function Badge({ children, variant = "idle" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${BADGE_STYLES[variant]}`}
    >
      {children}
    </span>
  );
}
