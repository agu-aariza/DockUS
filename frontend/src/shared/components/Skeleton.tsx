/**
 * @fileoverview Componente compartido de la interfaz EduCodeAI (Skeleton).
 *
 * @module Skeleton
 */

import React from "react";

interface SkeletonProps {
  className?: string;
  type?: "text" | "circular" | "rectangular" | "rounded";
}

export function Skeleton({ className = "", type = "text" }: SkeletonProps) {
  const baseClasses = "shimmer bg-slate-200/80 dark:bg-slate-700/60";

  let shapeClasses: string;
  switch (type) {
    case "circular":
      shapeClasses = "rounded-full";
      break;
    case "rectangular":
      shapeClasses = "rounded-none";
      break;
    case "rounded":
      shapeClasses = "rounded-2xl";
      break;
    case "text":
    default:
      shapeClasses = "rounded";
      break;
  }

  return (
    <div className={`${baseClasses} ${shapeClasses} ${className}`} />
  );
}

// Pre-built common skeletons
export function SkeletonCard() {
  return (
    // rounded-lg, no -3xl: es la esquina real de las tarjetas que reemplaza
    // (StudentReportsSection, StudentProfilePanel, TeacherProjectsPanel) —
    // antes cambiaba de forma visible en el momento en que llegaban los datos

    <div className="rounded-lg border border-app-border bg-app-surface p-6 shadow-sm">
      <div className="flex items-center gap-4 mb-4">
        <Skeleton type="circular" className="w-12 h-12" />
        <div className="space-y-2 flex-1">
          <Skeleton type="text" className="w-1/3 h-5" />
          <Skeleton type="text" className="w-1/4 h-4" />
        </div>
      </div>
      <div className="space-y-3">
        <Skeleton type="text" className="w-full h-4" />
        <Skeleton type="text" className="w-5/6 h-4" />
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 3 }: { rows?: number }) {
  return (
    // Mismo motivo que SkeletonCard: coincide con el rounded-lg de la tarjeta
    // real (p. ej. el <aside> de DeliveriesSidebar) en vez de un -3xl propio.
    <div className="rounded-lg border border-app-border bg-app-surface shadow-sm overflow-hidden">
      <div className="bg-app-bg-subtle border-b border-app-border px-6 py-4 flex gap-4">
        <Skeleton type="text" className="w-1/4 h-4" />
        <Skeleton type="text" className="w-1/4 h-4" />
        <Skeleton type="text" className="w-1/4 h-4" />
      </div>
      <div className="divide-y divide-app-border/60">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="px-6 py-4 flex gap-4 items-center">
            <Skeleton type="text" className="w-1/4 h-4" />
            <Skeleton type="text" className="w-1/4 h-4" />
            <Skeleton type="text" className="w-1/4 h-4" />
            <Skeleton type="rounded" className="w-20 h-8 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
