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
