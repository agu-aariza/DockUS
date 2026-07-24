import type { ReactNode } from "react";
import type { IconType } from "react-icons";

export type ReportCardTone =
  | "default"
  | "indigo"
  | "emerald"
  | "amber"
  | "rose"
  | "slate"
  | "sky";

interface ReportCardProps {
  tone?: ReportCardTone;
  icon?: IconType;
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
  dataTestId?: string;
}

const TONE_STYLES: Record<
  ReportCardTone,
  { card: string; icon: string; eyebrow: string }
> = {
  default: {
    card: "border-app-border bg-white",
    icon: "bg-slate-100 text-slate-600",
    eyebrow: "text-slate-400",
  },
  indigo: {
    card: "border-indigo-200 bg-white",
    icon: "bg-indigo-50 text-indigo-600",
    eyebrow: "text-indigo-600/80",
  },
  emerald: {
    card: "border-success-200 bg-white",
    icon: "bg-success-50 text-success-600",
    eyebrow: "text-success-600/80",
  },
  amber: {
    card: "border-warning-200 bg-white",
    icon: "bg-warning-50 text-warning-600",
    eyebrow: "text-warning-600/80",
  },
  rose: {
    card: "border-rose-200 bg-white",
    icon: "bg-rose-50 text-rose-600",
    eyebrow: "text-rose-600/80",
  },
  slate: {
    card: "border-slate-200 bg-white",
    icon: "bg-slate-100 text-slate-600",
    eyebrow: "text-slate-500",
  },
  sky: {
    card: "border-sky-200 bg-white",
    icon: "bg-sky-50 text-sky-600",
    eyebrow: "text-sky-600/80",
  },
};

export function ReportCard({
  tone = "default",
  icon: Icon,
  title,
  description,
  children,
  className = "",
  dataTestId,
}: ReportCardProps): JSX.Element {
  const styles = TONE_STYLES[tone];

  return (
    <section
      data-testid={dataTestId}
      className={`rounded-2xl border p-6 ${styles.card} ${className}`.trim()}
    >
      {(title || description) && (
        <div className="flex items-start gap-3">
          {Icon ? (
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${styles.icon}`}
            >
              <Icon className="text-xl" aria-hidden="true" />
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            {title ? (
              typeof title === "string" ? (
                <p
                  className={`text-xs font-semibold uppercase tracking-wider ${styles.eyebrow}`}
                >
                  {title}
                </p>
              ) : (
                <div
                  className={`text-xs font-semibold uppercase tracking-wider ${styles.eyebrow}`}
                >
                  {title}
                </div>
              )
            ) : null}
            {description ? (
              typeof description === "string" ? (
                <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
                  {description}
                </h3>
              ) : (
                <div className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
                  {description}
                </div>
              )
            ) : null}
          </div>
        </div>
      )}
      {children ? <div className="mt-6">{children}</div> : null}
    </section>
  );
}
