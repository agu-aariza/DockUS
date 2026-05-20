import React, { type ReactNode } from "react";

interface ButtonProps {
  variant?: "primary" | "secondary" | "tertiary" | "ghost" | "danger" | "success";
  children: ReactNode;
  className?: string;
  onClick?: any;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  title?: string;
}

const VARIANT_STYLES = {
  primary:
    "bg-academic-primary text-academic-on-primary hover:bg-academic-primary-container focus-visible:ring-academic-primary/30 shadow-academic",
  secondary:
    "border border-academic-secondary bg-transparent text-academic-secondary hover:bg-academic-secondary hover:text-white focus-visible:ring-academic-secondary/30 shadow-sm",
  tertiary:
    "bg-academic-surface-variant text-academic-on-surface-variant hover:bg-academic-surface-container-high focus-visible:ring-academic-outline/30",
  ghost:
    "bg-transparent text-academic-on-surface-variant hover:text-academic-primary hover:bg-academic-surface-container-low focus-visible:ring-academic-primary/10",
  danger:
    "bg-academic-error text-academic-on-error hover:bg-academic-error-container hover:text-academic-on-error-container focus-visible:ring-academic-error/30 shadow-academic",
  success:
    "bg-academic-tertiary text-academic-on-tertiary hover:bg-academic-tertiary-container hover:text-academic-on-tertiary-container focus-visible:ring-academic-tertiary/30 shadow-academic",
} as const;

export function Button({ 
  variant = "primary", 
  children, 
  className = "", 
  ...props 
}: ButtonProps) {
  return (
    <button 
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all active:scale-[0.98] hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-2 ${VARIANT_STYLES[variant]} ${className}`} 
      {...props}
    >
      {children}
    </button>
  );
}
