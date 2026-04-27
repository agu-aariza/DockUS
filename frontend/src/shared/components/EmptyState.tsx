import React, { ReactNode } from "react";
import { RiFolderUnknowLine, RiAddLine } from "react-icons/ri";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon = <RiFolderUnknowLine className="text-5xl text-slate-300" />,
  title,
  description,
  actionLabel,
  onAction,
  className = ""
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center p-12 text-center rounded-3xl border border-dashed border-slate-300 bg-slate-50/50 ${className}`}>
      <div className="mb-4 bg-white p-4 rounded-full shadow-sm border border-slate-100">
        {icon}
      </div>
      <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-500 max-w-sm mb-6 leading-relaxed">
        {description}
      </p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white font-bold text-sm rounded-xl hover:bg-indigo-500 transition shadow-sm"
        >
          <RiAddLine className="text-lg" />
          {actionLabel}
        </button>
      )}
    </div>
  );
}
