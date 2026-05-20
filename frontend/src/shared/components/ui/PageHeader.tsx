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
 * Ensures a consistent, premium feel across the application.
 */
export function PageHeader({ title, subtitle, icon, actions, badge }: PageHeaderProps): JSX.Element {
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between mb-10 animate-in fade-in slide-in-from-top-4 duration-700">
      <div className="flex items-start gap-5">
        {icon && (
          <div className="hidden sm:flex h-16 w-16 rounded-3xl bg-academic-surface-container-low border border-academic-outline-variant/30 items-center justify-center text-brand-blue text-3xl shadow-academic group-hover:scale-105 transition-transform duration-500">
            <div className="bg-brand-blue/5 rounded-2xl p-3 text-brand-blue">
              {icon}
            </div>
          </div>
        )}
        <div className="space-y-1.5">
          <div className="flex items-center gap-4 flex-wrap">
            <h2 className="font-display text-3xl font-black text-academic-on-surface tracking-tight sm:text-4xl lg:text-5xl uppercase">
              {title}
            </h2>
            {badge && (
              <span className="inline-flex items-center px-4 py-1.5 rounded-full ui-label bg-brand-blue text-white shadow-lg shadow-brand-blue/10 border border-brand-blue-dark">
                {badge}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-academic-on-surface-variant text-sm sm:text-base font-medium leading-relaxed max-w-3xl">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 mt-4 lg:mt-0">
        {actions}
      </div>
    </div>
  );
}
