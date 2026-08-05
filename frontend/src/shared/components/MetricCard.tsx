/**
 * @fileoverview Componente compartido de la interfaz EduCodeAI (MetricCard).
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
  /** Placeholder con la misma forma que la tarjeta cargada. */
  loading?: boolean;
}

// El acento vive en un filete vertical (misma idea que `.accent-rule` en
// PageHeader), no en un icono grande flotando en la esquina — ese patrón de
// "stat card" con icono en la esquina es el que más se repite en cualquier
// dashboard genérico. Aquí el icono baja de tamaño y se lee junto a la
// etiqueta, como un eyebrow más.
const TONE_STYLES: Record<
  NonNullable<MetricCardProps["variant"]>,
  { bar: string; icon: string }
> = {
  default: { bar: "bg-app-text-muted/30", icon: "text-app-text-muted" },
  dark: { bar: "bg-app-text-muted/30", icon: "text-app-text-muted" },
  warning: { bar: "bg-warning", icon: "text-warning" },
  success: { bar: "bg-success", icon: "text-success" },
  info: { bar: "bg-primary", icon: "text-primary" },
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
  // Cifras cortas ("4", "25%") se leen grandes; una frase ("Sin definir")
  // necesita bajar de tamaño para no partirse en dos líneas en una tarjeta
  // estrecha — de ahí mirar también si trae un espacio, no solo la longitud.
  const isLongValue =
    typeof value === "string" && (value.length > 10 || value.includes(" "));
  const valueClassName = isLongValue
    ? "data-figure text-lg font-semibold leading-tight"
    : "data-figure text-2xl font-semibold leading-tight";
  const tone = TONE_STYLES[variant];

  if (loading) {
    return (
      <div
        className={`relative overflow-hidden rounded-lg border border-app-border bg-app-surface py-4 pl-5 pr-4 ${className}`}
        aria-busy="true"
        aria-label={label}
      >
        <div className="flex items-center gap-2">
          <Skeleton type="circular" className="h-3 w-3" />
          <Skeleton type="text" className="h-3 w-16" />
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
      className={`relative overflow-hidden rounded-lg border border-app-border bg-app-surface py-4 pl-5 pr-4 ${className}`}
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${tone.bar}`} aria-hidden="true" />

      <div className={`flex items-center gap-1.5 ${tone.icon}`}>
        <span className="text-sm">{icon}</span>
        <span className="ui-label">{label}</span>
      </div>

      <div className={`mt-2 text-app-text ${valueClassName}`}>{value}</div>

      {helper ? (
        <p className="mt-1 text-xs text-app-text-muted">{helper}</p>
      ) : null}
    </div>
  );
}
