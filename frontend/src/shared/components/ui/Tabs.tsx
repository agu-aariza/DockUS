import React from 'react';

interface TabItem {
  id: string;
  label: string;
  icon?: React.ElementType | React.ReactNode;
  badge?: number | boolean;
  disabled?: boolean;
}

interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (_id: string) => void;
  className?: string;
  /** @deprecated Mantenido por compatibilidad; se ignora. */
  variant?: string;
}

export function Tabs({
  tabs,
  activeTab,
  onTabChange,
  className = ""
}: TabsProps) {
  return (
    <div className={`border-b border-app-border ${className}`}>
      <nav className="-mb-px flex" aria-label="Tabs">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              disabled={tab.disabled}
              onClick={() => onTabChange(tab.id)}
              className={`group relative inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 ${
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
              } ${tab.disabled ? 'cursor-not-allowed opacity-50' : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              {Icon && (
                <span className={isActive ? 'text-primary' : 'text-slate-400 group-hover:text-slate-500'}>
                  {typeof Icon === 'function' ? <Icon className="text-base" /> : Icon}
                </span>
              )}
              {tab.label}
              {typeof tab.badge === 'number' && tab.badge > 0 && (
                <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                  isActive ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  {tab.badge}
                </span>
              )}
              {tab.badge === true && (
                <span className={`ml-1 h-1.5 w-1.5 rounded-full ${isActive ? 'bg-primary' : 'bg-slate-400'}`} aria-hidden="true" />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
