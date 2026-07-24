/**
 * @fileoverview Componente compartido de la interfaz DockUS (MetricCard).
 *
 * @module MetricCard
 */

import type { ReactNode } from "react";
import { Skeleton } from "./Skeleton";

export interface MetricCardProps {
  label: string;
  value: string | number;
  helper?: string;
  icon: ReactNode;
  variant?: "default" | "dark" | "warning" | "success" | "info";
  className?: string;
  /** Placeholder con la misma forma que la tarjeta cargada (FE-MED-03). */
  loading?: boolean;
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
  loading = false,
}: MetricCardProps): JSX.Element {
  const isLongValue = typeof value === "string" && value.length > 12;
  const valueClassName = isLongValue
    ? "data-figure text-lg font-semibold sm:text-xl"
    : "data-figure text-2xl font-semibold";

  if (loading) {
    return (
      <div
        className={`rounded-lg border border-app-border bg-app-surface p-4 ${className}`}
        aria-busy="true"
        aria-label={label}
      >
        <div className="flex items-start justify-between gap-3">
          <Skeleton type="text" className="h-3 w-16" />
          <Skeleton type="circular" className="h-4 w-4" />
        </div>
        <Skeleton type="text" className="mt-3 h-7 w-14" />
        {helper !== undefined ? (
          <Skeleton type="text" className="mt-2 h-3 w-24" />
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border border-app-border bg-app-surface p-4 ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-app-text-muted">
          {label}
        </span>
        <span className={`text-base ${ICON_COLORS[variant]}`}>{icon}</span>
      </div>

      <div className={`mt-2 ${valueClassName}`}>{value}</div>

      {helper ? (
        <p className="mt-1 text-xs text-app-text-muted">{helper}</p>
      ) : null}
    </div>
  );
}
