/**
 * @fileoverview Componente compartido de la interfaz DockUS (EmptyState).
 *
 * @module EmptyState
 */

import React, { type ReactNode } from "react";
import { RiFolderUnknowLine, RiAddLine } from "react-icons/ri";
import { Button } from "./ui/Button";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon = <RiFolderUnknowLine className="text-3xl text-slate-400" />,
  title,
  description,
  actionLabel,
  onAction,
  className = ""
}: EmptyStateProps) {
  return (
    // rounded-lg: la misma esquina de tarjeta que usan las secciones que
    // envuelven este empty state (DeliveryGrading, TeacherDeliveriesPanel,
    // etc.), en vez de la -2xl que solo tenía este componente (UX-MED-02).
    <div className={`flex flex-col items-center justify-center rounded-lg border border-dashed border-app-border bg-app-bg-subtle/30 p-10 text-center transition-all duration-300 hover:border-slate-300/80 dark:hover:border-slate-600 ${className}`}>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-gradient-to-b from-app-surface to-app-bg-subtle/80 border border-app-border/60 text-app-text-muted shadow-sm transition-transform duration-300 hover:scale-105 hover:rotate-3">
        {icon}
      </div>
      <h3 className="mb-1.5 text-sm font-bold text-app-text">{title}</h3>
      <p className="mb-5 max-w-xs text-xs leading-relaxed text-app-text-muted">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button 
          onClick={onAction} 
          size="sm"
          className="shadow-sm hover:shadow active:scale-[0.98] transition-all"
        >
          <RiAddLine className="text-base" />
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
