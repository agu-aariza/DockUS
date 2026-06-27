import React from 'react';
import { RiFolderOpenLine, RiArrowRightLine } from 'react-icons/ri';
import { StatusBadge, type StatusTone } from './StatusBadge';

export interface ProjectListItemData {
  id: string;
  title: string;
  description?: string;
  status?: StatusTone;
  statusLabel?: string;
  meta?: string;
  dueDate?: string;
}

interface ProjectListItemProps {
  project: ProjectListItemData;
  onClick?: (_project: ProjectListItemData) => void;
  isActive?: boolean;
  className?: string;
}

export function ProjectListItem({ project, onClick, isActive, className = '' }: ProjectListItemProps) {
  return (
    <button
      onClick={() => onClick?.(project)}
      className={`flex w-full items-start gap-3 rounded-md border px-3 py-2.5 text-left transition-colors ${
        isActive
          ? 'border-primary/30 bg-primary-subtle'
          : 'border-app-border bg-white hover:bg-slate-50'
      } ${className}`}
    >
      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${isActive ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-500'}`}>
        <RiFolderOpenLine className="text-base" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className={`truncate text-sm font-medium ${isActive ? 'text-primary' : 'text-slate-900'}`}>
            {project.title}
          </p>
          {project.status && project.statusLabel && (
            <StatusBadge tone={project.status} className="shrink-0">
              {project.statusLabel}
            </StatusBadge>
          )}
        </div>
        {project.description && (
          <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{project.description}</p>
        )}
        {(project.meta || project.dueDate) && (
          <p className="mt-1 text-xs text-slate-400">
            {project.meta}
            {project.meta && project.dueDate && ' · '}
            {project.dueDate}
          </p>
        )}
      </div>
      <RiArrowRightLine className="mt-1 shrink-0 text-slate-400" />
    </button>
  );
}
