import React from "react";

interface MetricCardProps {
  label: string;
  value: string | number;
  helper?: string;
  icon: React.ReactNode;
  variant?: "default" | "dark" | "warning" | "success" | "info" | "whale";
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
  // Premium academic gradient backgrounds
  const variants = {
    default: "bg-gradient-to-br from-white to-academic-surface/30 border-academic-outline-variant/60 text-academic-on-surface",
    dark: "bg-gradient-to-br from-brand-blue to-brand-blue-dark border-brand-blue-dark text-white shadow-xl shadow-brand-blue/15",
    warning: "bg-gradient-to-br from-white to-amber-50/20 border-amber-100 text-amber-950",
    success: "bg-gradient-to-br from-white to-emerald-50/20 border-emerald-100 text-emerald-950",
    info: "bg-gradient-to-br from-white to-brand-blue/[0.02] border-brand-blue/10 text-brand-blue-dark",
    whale: "bg-gradient-to-br from-white to-brand-blue/[0.02] border-brand-blue/10 text-brand-blue-dark",
  };

  // Colored indicator bar for alignment and anchoring
  const barColors = {
    default: "bg-academic-secondary", // brand gold
    dark: "bg-brand-gold-light",
    warning: "bg-amber-500",
    success: "bg-emerald-500",
    info: "bg-academic-primary",      // brand maroon
    whale: "bg-brand-blue",
  };

  const labelColors = {
    default: "text-academic-outline",
    dark: "text-brand-gold-light/70",
    warning: "text-amber-700/80",
    success: "text-emerald-700/80",
    info: "text-brand-blue/70",
    whale: "text-brand-blue/70",
  };

  const iconBgs = {
    default: "bg-academic-surface-container/50 border-academic-outline-variant/40 text-academic-secondary",
    dark: "bg-white/10 border-white/10 text-brand-gold-light",
    warning: "bg-amber-100/50 border-amber-200/50 text-amber-700",
    success: "bg-emerald-100/50 border-emerald-200/50 text-emerald-700",
    info: "bg-brand-blue/5 border-brand-blue/10 text-brand-blue",
    whale: "bg-brand-blue/5 border-brand-blue/10 text-brand-blue",
  };

  const hoverBorders = {
    default: "hover:border-academic-secondary/35",
    dark: "hover:border-white/20",
    warning: "hover:border-amber-300/40",
    success: "hover:border-emerald-300/40",
    info: "hover:border-brand-blue/30",
    whale: "hover:border-brand-blue/30",
  };

  // Adjust font size dynamically for long date strings (e.g. 12/5/2026, 18:29:18)
  const isLongValue = typeof value === "string" && value.length > 12;
  const valueClass = isLongValue
    ? "text-lg sm:text-xl font-bold tracking-tight text-academic-on-surface"
    : "text-2xl sm:text-3xl font-black tracking-tight text-academic-on-surface";

  return (
    <article
      className={`group/metric relative overflow-hidden rounded-[2rem] border pl-7 pr-6 py-6 transition-all duration-500 hover:shadow-academic ${variants[variant]} ${hoverBorders[variant]} ${className}`}
    >
      {/* Accent strip on the left */}
      <div className={`absolute left-0 top-0 bottom-0 w-[5px] rounded-l-full transition-all duration-500 group-hover/metric:w-[7px] ${barColors[variant]}`} />

      {/* Decorative hover light spot */}
      <div className="absolute right-0 top-0 -mt-10 -mr-10 h-32 w-32 rounded-full bg-academic-secondary/5 opacity-0 transition-opacity duration-700 group-hover/metric:opacity-100 pointer-events-none blur-2xl" />

      <div className="flex items-center justify-between mb-4 relative z-10">
        <span className={`font-mono text-[10px] font-black uppercase tracking-[0.15em] ${labelColors[variant]}`}>
          {label}
        </span>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition-all duration-500 group-hover/metric:scale-105 group-hover/metric:rotate-3 ${iconBgs[variant]} shadow-sm`}>
          <div className="text-lg">{icon}</div>
        </div>
      </div>

      <div className="relative z-10">
        <div className={`${valueClass} leading-none`}>
          {value}
        </div>
        {helper && (
          <p className="mt-3 font-mono text-[9px] font-bold uppercase tracking-wider text-academic-outline flex items-center gap-1.5 opacity-80">
            <span className={`h-1.5 w-1.5 rounded-full ${barColors[variant]} opacity-70`} />
            {helper.replace(/^[\s\.]*/, "") /* Clean up leading dots */}
          </p>
        )}
      </div>
    </article>
  );
}
