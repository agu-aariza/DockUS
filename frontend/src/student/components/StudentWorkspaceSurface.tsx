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
  default: "border-app-border bg-white",
  accent: "border-primary/20 bg-primary-subtle",
  subtle: "border-app-border bg-slate-50",
  warm: "border-warning-200 bg-warning-50",
};

export function StudentSurface({
  children,
  className = "",
  tone = "default",
}: StudentSurfaceProps): JSX.Element {
  // `subtle` se usa como panel anidado: elevarlo aplanaría la jerarquía en vez de crearla.
  const elevation = tone === "subtle" ? "" : "shadow-sm";

  return (
    <section
      className={`rounded-lg border p-5 ${elevation} ${SURFACE_TONE[tone]} ${className}`}
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
        {eyebrow ? (
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {eyebrow}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          {badge}
        </div>
        {description ? (
          <p className="max-w-3xl text-sm leading-6 text-slate-500">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-3">{actions}</div>
      ) : null}
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
          className="rounded-lg border border-app-border bg-white px-4 py-3"
        >
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {item.label}
          </div>
          <div className="mt-2 text-sm font-medium text-slate-900">
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}
