import React from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  badge?: string;
}

/**
 * Shared header component for all dashboard panels.
 * Compact, functional and consistent with the institutional B2B style.
 */
export function PageHeader({ title, subtitle, icon, actions, badge }: PageHeaderProps): JSX.Element {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
        {icon && (
          <div className="hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent-subtle text-accent">
            {icon}
          </div>
        )}
        <div>
          <div className="accent-rule mb-2.5" aria-hidden="true" />
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight text-app-text">
              {title}
            </h1>
            {badge && (
              <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary-subtle px-2.5 py-0.5 font-mono text-xs font-medium text-primary">
                {badge}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="mt-1 max-w-2xl text-sm text-app-text-muted">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 sm:pt-0.5">
          {actions}
        </div>
      )}
    </div>
  );
}
