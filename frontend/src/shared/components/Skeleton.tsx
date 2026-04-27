import React from "react";

interface SkeletonProps {
  className?: string;
  type?: "text" | "circular" | "rectangular" | "rounded";
}

export function Skeleton({ className = "", type = "text" }: SkeletonProps) {
  const baseClasses = "animate-pulse bg-slate-200";
  
  let shapeClasses = "";
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
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
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
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex gap-4">
        <Skeleton type="text" className="w-1/4 h-4" />
        <Skeleton type="text" className="w-1/4 h-4" />
        <Skeleton type="text" className="w-1/4 h-4" />
      </div>
      <div className="divide-y divide-slate-100">
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
