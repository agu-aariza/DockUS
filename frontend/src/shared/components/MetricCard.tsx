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
  const variants = {
    default: "bg-white border-slate-200 text-slate-950",
    dark: "bg-brand-blue border-brand-blue-dark text-white shadow-xl shadow-brand-blue/20",
    warning: "bg-amber-50 border-amber-100 text-amber-950",
    success: "bg-emerald-50 border-emerald-100 text-emerald-950",
    info: "bg-brand-blue/5 border-brand-blue/10 text-brand-blue-dark",
    whale: "bg-brand-blue/5 border-brand-blue/10 text-brand-blue-dark",
  };

  const labelColors = {
    default: "text-brand-gold",
    dark: "text-brand-gold-light/60",
    warning: "text-amber-500/80",
    success: "text-emerald-500/80",
    info: "text-brand-blue/60",
    whale: "text-brand-blue/60",
  };

  const iconBgs = {
    default: "bg-brand-blue/5 text-brand-blue",
    dark: "bg-white/10 text-brand-gold-light",
    warning: "bg-amber-100 text-amber-600",
    success: "bg-emerald-100 text-emerald-600",
    info: "bg-brand-blue/10 text-brand-blue",
    whale: "bg-brand-blue/10 text-brand-blue",
  };

  return (
    <article
      className={`group/metric relative overflow-hidden rounded-[2rem] border p-6 transition-all duration-500 hover:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.08)] hover:-translate-y-1 ${variants[variant]} ${className}`}
    >
      <div className="flex items-center justify-between mb-4 relative z-10">
        <span className={`eyebrow ${labelColors[variant]}`}>
          {label}
        </span>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-all duration-500 group-hover/metric:scale-110 group-hover/metric:rotate-6 ${iconBgs[variant]} shadow-sm`}>
          <div className="text-xl">{icon}</div>
        </div>
      </div>
      
      <div className="relative z-10">
        <div className="text-3xl font-black tracking-tight leading-none group-hover/metric:scale-[1.02] transition-transform duration-500 origin-left">
          {value}
        </div>
        {helper && (
          <p className={`mt-3 ui-label opacity-60 flex items-center gap-2`}>
            <span className="h-1 w-1 rounded-full bg-current opacity-40" />
            {helper}
          </p>
        )}
      </div>

      {/* Subtle background decoration for premium feel */}
      <div className="absolute -right-2 -bottom-2 opacity-[0.03] pointer-events-none transform rotate-12 scale-150 transition-transform duration-700 group-hover:rotate-0">
        <div className="text-6xl">{icon}</div>
      </div>
    </article>
  );
}
