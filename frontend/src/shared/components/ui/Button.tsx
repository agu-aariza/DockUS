import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "tertiary" | "ghost" | "danger";
  children: ReactNode;
  className?: string;
}

const VARIANT_STYLES = {
  primary:
    "bg-brand-primary text-white hover:bg-brand-maroon-dark focus-visible:ring-brand-primary/30 shadow-lg shadow-brand-primary/20",
  secondary:
    "bg-brand-secondary text-white hover:bg-brand-gold-dark focus-visible:ring-brand-secondary/30 shadow-lg shadow-brand-secondary/20",
  tertiary:
    "bg-brand-tertiary text-white hover:bg-brand-blue-dark focus-visible:ring-brand-tertiary/30 shadow-lg shadow-brand-tertiary/20",
  ghost:
    "border border-slate-200 bg-white text-slate-600 hover:border-brand-primary/30 hover:bg-brand-primary/5 focus-visible:ring-brand-primary/10",
  danger:
    "bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-200 shadow-lg shadow-rose-600/20",
} as const;

export function Button({ 
  variant = "primary", 
  children, 
  className = "", 
  ...props 
}: ButtonProps) {
  return (
    <button 
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 ${VARIANT_STYLES[variant]} ${className}`} 
      {...props}
    >
      {children}
    </button>
  );
}
