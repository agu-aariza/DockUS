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
    <div className={`flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50/50 p-10 text-center ${className}`}>
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500">
        {icon}
      </div>
      <h3 className="mb-1 text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mb-4 max-w-sm text-sm text-slate-500">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button onClick={onAction} size="sm">
          <RiAddLine className="text-base" />
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
