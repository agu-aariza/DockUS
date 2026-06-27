import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  headerAction?: ReactNode;
}

export function Card({ children, className = "", title, headerAction }: CardProps) {
  return (
    <article className={`rounded-lg border border-app-border bg-white ${className}`}>
      {(title || headerAction) && (
        <div className="flex flex-col gap-2 border-b border-app-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          {title && (
            <h3 className="text-sm font-semibold text-slate-900">
              {title}
            </h3>
          )}
          {headerAction}
        </div>
      )}
      <div className="p-4">{children}</div>
    </article>
  );
}

interface SectionCardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  description?: string;
  headerAction?: ReactNode;
}

export function SectionCard({ children, className = "", title, description, headerAction }: SectionCardProps) {
  return (
    <section className={`rounded-lg border border-app-border bg-white ${className}`}>
      {(title || headerAction) && (
        <div className="flex flex-col gap-2 border-b border-app-border px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {title && <h3 className="text-sm font-semibold text-slate-900">{title}</h3>}
            {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
          </div>
          {headerAction}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

interface BadgeProps {
  children: ReactNode;
  variant?: "idle" | "success" | "warning" | "danger" | "info" | "running" | "closed";
}

const BADGE_STYLES: Record<NonNullable<BadgeProps["variant"]>, string> = {
  idle: "border-slate-200 bg-slate-100 text-slate-600",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  danger: "border-red-200 bg-red-50 text-red-700",
  info: "border-blue-200 bg-blue-50 text-blue-700",
  running: "border-indigo-200 bg-indigo-50 text-indigo-700",
  closed: "border-slate-200 bg-slate-100 text-slate-500",
};

export function Badge({ children, variant = "idle" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${BADGE_STYLES[variant]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" aria-hidden="true" />
      {children}
    </span>
  );
}
