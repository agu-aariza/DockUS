import React from "react";

export interface MetricCardProps {
  label: string;
  value: string | number;
  helper?: string;
  icon: React.ReactNode;
  variant?: "default" | "dark" | "warning" | "success" | "info";
  className?: string;
}

export function MetricCard({
  label,
  value,
  helper,
  icon,
  variant = "default",
  className = "",
}: MetricCardProps) {
  const variants = {
    default: "border-slate-200 bg-white text-slate-900",
    dark: "border-slate-800 bg-slate-900 text-white",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    info: "border-blue-200 bg-blue-50 text-blue-900",
  };

  const barColors = {
    default: "bg-slate-400",
    dark: "bg-slate-600",
    warning: "bg-amber-500",
    success: "bg-emerald-500",
    info: "bg-blue-500",
  };

  const labelColors = {
    default: "text-slate-500",
    dark: "text-slate-400",
    warning: "text-amber-700",
    success: "text-emerald-700",
    info: "text-blue-700",
  };

  const iconColors = {
    default: "bg-slate-100 text-slate-600",
    dark: "bg-slate-800 text-slate-300",
    warning: "bg-amber-100 text-amber-700",
    success: "bg-emerald-100 text-emerald-700",
    info: "bg-blue-100 text-blue-700",
  };

  const isLongValue = typeof value === "string" && value.length > 12;
  const valueClass = isLongValue
    ? "text-lg sm:text-xl font-semibold tracking-tight"
    : "text-2xl font-semibold tracking-tight";

  return (
    <article
      className={`relative overflow-hidden rounded-lg border p-4 ${variants[variant]} ${className}`}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${barColors[variant]}`} aria-hidden="true" />

      <div className="flex items-start justify-between mb-3">
        <span className={`text-xs font-medium uppercase tracking-wide ${labelColors[variant]}`}>
          {label}
        </span>
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${iconColors[variant]}`}>
          <span className="text-base">{icon}</span>
        </div>
      </div>

      <div className={valueClass}>
        {value}
      </div>

      {helper && (
        <p className={`mt-2 text-xs flex items-center gap-1.5 ${labelColors[variant]}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${barColors[variant]}`} aria-hidden="true" />
          {helper.replace(/^[\s.]*/, "")}
        </p>
      )}
    </article>
  );
}
