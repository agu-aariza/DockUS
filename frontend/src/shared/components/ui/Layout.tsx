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
  className?: string;
  icon?: ReactNode;
}

const BADGE_STYLES: Record<NonNullable<BadgeProps["variant"]>, string> = {
  idle: "border-slate-200 bg-slate-50 text-slate-600",
  closed: "border-slate-200 bg-slate-50 text-slate-500",
  success: "border-success/20 bg-success-subtle text-success",
  warning: "border-warning/20 bg-warning-subtle text-warning",
  danger: "border-danger/20 bg-danger-subtle text-danger",
  info: "border-primary/20 bg-primary-subtle text-primary",
  running: "border-primary/20 bg-primary-subtle text-primary",
};

export function Badge({ children, variant = "idle", className = "", icon }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${BADGE_STYLES[variant]} ${className}`}
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
