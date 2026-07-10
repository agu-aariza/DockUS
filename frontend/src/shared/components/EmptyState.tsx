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
    <div className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/30 p-10 text-center transition-all duration-300 hover:border-slate-300/80 ${className}`}>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-b from-white to-slate-100/80 border border-slate-200/60 text-slate-500 shadow-sm transition-transform duration-300 hover:scale-105 hover:rotate-3">
        {icon}
      </div>
      <h3 className="mb-1.5 text-sm font-bold text-slate-900">{title}</h3>
      <p className="mb-5 max-w-xs text-xs leading-relaxed text-slate-500">
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
