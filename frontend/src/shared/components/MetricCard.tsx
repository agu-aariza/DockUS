import type { ReactNode } from "react";

export interface MetricCardProps {
  label: string;
  value: string | number;
  helper?: string;
  icon: ReactNode;
  variant?: "default" | "dark" | "warning" | "success" | "info";
  className?: string;
}

const ICON_COLORS: Record<NonNullable<MetricCardProps["variant"]>, string> = {
  default: "text-slate-500",
  dark: "text-slate-400",
  warning: "text-warning",
  success: "text-success",
  info: "text-primary",
};

export function MetricCard({
  label,
  value,
  helper,
  icon,
  variant = "default",
  className = "",
}: MetricCardProps): JSX.Element {
  const isLongValue = typeof value === "string" && value.length > 12;
  const valueClassName = isLongValue
    ? "text-lg sm:text-xl font-semibold tracking-tight text-slate-900"
    : "text-2xl font-semibold tracking-tight text-slate-900";

  return (
    <div
      className={`rounded-lg border border-app-border bg-white p-4 ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </span>
        <span className={`text-base ${ICON_COLORS[variant]}`}>{icon}</span>
      </div>

      <div className={`mt-2 ${valueClassName}`}>{value}</div>

      {helper ? (
        <p className="mt-1 text-xs text-slate-500">{helper}</p>
      ) : null}
    </div>
  );
}
