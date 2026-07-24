/**
 * @fileoverview Componente UI base del sistema de diseño DockUS (Button).
 *
 * @module Button
 */

import React, { type ReactNode, type ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "tertiary" | "ghost" | "danger" | "success";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
  className?: string;
}

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-white hover:bg-primary-hover focus-visible:ring-primary/40 active:bg-primary-800",
  secondary:
    "border border-slate-300 bg-app-surface text-app-text-secondary hover:bg-app-bg-subtle hover:text-app-text focus-visible:ring-slate-300 active:bg-app-bg-subtle dark:border-slate-600",
  tertiary:
    "bg-app-bg-subtle text-app-text-secondary hover:bg-slate-200 focus-visible:ring-slate-300 active:bg-slate-300 dark:hover:bg-slate-700 dark:active:bg-slate-600",
  ghost:
    "bg-transparent text-app-text-secondary hover:bg-app-bg-subtle hover:text-app-text focus-visible:ring-slate-300 active:bg-slate-200 dark:active:bg-slate-700",
  danger:
    "border border-danger-300 bg-app-surface text-danger-700 hover:bg-danger-50 focus-visible:ring-danger-300 active:bg-danger-100 dark:text-danger-400 dark:hover:bg-danger-subtle",
  success:
    "bg-success-600 text-white hover:bg-success-700 focus-visible:ring-success-500/40 active:bg-success-800",
};

const SIZE_STYLES: Record<ButtonSize, string> = {
  sm: "gap-1.5 px-2.5 py-1.5 text-xs min-h-6",
  md: "gap-2 px-3 py-2 text-sm",
  lg: "gap-2 px-4 py-2.5 text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  type,
  children,
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type ?? "button"}
      className={`inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-app-bg disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_STYLES[variant]} ${SIZE_STYLES[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  className?: string;
  label: string;
}

export function IconButton({ children, className = "", label, ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      className={`inline-flex items-center justify-center rounded-md p-2 text-app-text-muted transition-colors hover:bg-app-bg-subtle hover:text-app-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
