import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "danger";
  children: ReactNode;
}

const VARIANT_STYLES = {
  primary:
    "bg-slate-900 text-white hover:bg-slate-800 focus-visible:ring-slate-300",
  ghost:
    "border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50 focus-visible:ring-slate-200",
  danger:
    "bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-200",
} as const;

export function Button({ 
  variant = "primary", 
  children, 
  className = "", 
  ...props 
}: ButtonProps) {
  return (
    <button 
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_STYLES[variant]} ${className}`} 
      {...props}
    >
      {children}
    </button>
  );
}
