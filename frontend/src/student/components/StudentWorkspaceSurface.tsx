import type { ReactNode } from "react";

interface StudentSurfaceProps {
  children: ReactNode;
  className?: string;
  tone?: "default" | "accent" | "subtle" | "warm";
}

interface StudentSurfaceHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  badge?: ReactNode;
  className?: string;
}

interface StudentKeyValueItem {
  label: string;
  value: ReactNode;
}

interface StudentKeyValueListProps {
  items: StudentKeyValueItem[];
  columns?: 1 | 2;
  className?: string;
}

const SURFACE_TONE: Record<NonNullable<StudentSurfaceProps["tone"]>, string> = {
  default:
    "border-academic-surface-variant bg-white shadow-sm",
  accent:
    "border-brand-blue/10 bg-gradient-to-br from-white via-white to-brand-blue/5 shadow-academic",
  subtle:
    "border-academic-surface-variant bg-academic-surface-container-lowest shadow-sm",
  warm:
    "border-academic-surface-variant bg-gradient-to-br from-white via-white to-academic-surface-container-low shadow-sm",
};

export function StudentSurface({
  children,
  className = "",
  tone = "default",
}: StudentSurfaceProps): JSX.Element {
  return (
    <section
      className={`rounded-[2rem] border p-6 ${SURFACE_TONE[tone]} ${className}`}
    >
      {children}
    </section>
  );
}

export function StudentSurfaceHeader({
  eyebrow,
  title,
  description,
  actions,
  badge,
  className = "",
}: StudentSurfaceHeaderProps): JSX.Element {
  return (
    <div
      className={`flex flex-col gap-4 md:flex-row md:items-start md:justify-between ${className}`}
    >
      <div className="space-y-2">
        {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="font-display text-2xl font-semibold tracking-tight text-academic-on-surface">
            {title}
          </h3>
          {badge}
        </div>
        {description ? (
          <p className="max-w-3xl text-sm leading-6 text-academic-on-surface-variant">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
}

export function StudentKeyValueList({
  items,
  columns = 2,
  className = "",
}: StudentKeyValueListProps): JSX.Element {
  const gridClassName =
    columns === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2";

  return (
    <div className={`grid gap-3 ${gridClassName} ${className}`}>
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-2xl border border-academic-surface-variant bg-white/80 px-4 py-3"
        >
          <div className="ui-label text-academic-outline">{item.label}</div>
          <div className="mt-2 text-sm font-medium text-academic-on-surface">
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}
