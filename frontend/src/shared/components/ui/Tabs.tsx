import React from 'react';

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ElementType | React.ReactNode;
  onClick?: () => void;
  badge?: boolean;
}

interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (id: string) => void;
  variant?: 'primary' | 'secondary' | 'tertiary';
  className?: string;
}

export function Tabs({ 
  tabs, 
  activeTab, 
  onTabChange, 
  variant = 'primary',
  className = "" 
}: TabsProps) {
  const variantStyles = {
    primary: {
      active: "bg-brand-primary text-white shadow-[0_8px_20px_-4px_rgba(128,0,0,0.3)]",
      inactive: "text-slate-500 hover:text-slate-900 hover:bg-white",
      container: "bg-slate-50"
    },
    secondary: {
      active: "bg-brand-secondary text-white shadow-[0_8px_20px_-4px_rgba(212,175,55,0.3)]",
      inactive: "text-slate-500 hover:text-slate-900 hover:bg-white",
      container: "bg-slate-50"
    },
    tertiary: {
      active: "bg-brand-tertiary text-white shadow-[0_8px_20px_-4px_rgba(40,80,150,0.3)]",
      inactive: "text-slate-500 hover:text-slate-700 hover:bg-white",
      container: "bg-slate-100/50"
    }
  };

  const styles = variantStyles[variant];

  return (
    <div className={`flex flex-wrap gap-2 p-1.5 rounded-[2.5rem] border border-slate-100 w-fit shadow-inner ${styles.container} ${className}`}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`group/tab relative inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold transition-all duration-300 ${
            activeTab === tab.id ? styles.active : styles.inactive
          }`}
          onClick={() => {
            onTabChange(tab.id);
            if (tab.onClick) tab.onClick();
          }}
        >
          {tab.icon && (
            <span className={`text-lg transition-transform duration-300 ${activeTab === tab.id ? 'scale-110' : 'group-hover/tab:scale-110 group-hover/tab:rotate-6'}`}>
              {typeof tab.icon === 'function' ? React.createElement(tab.icon as React.ElementType) : tab.icon}
            </span>
          )}
          {tab.label}
          {tab.badge && (
            <span className={`absolute -top-1 -right-1 h-3 w-3 rounded-full border-2 border-white animate-pulse ${
              activeTab === tab.id ? 'bg-white' : 'bg-brand-primary'
            }`} />
          )}
          {activeTab === tab.id && (
            <div className={`absolute inset-0 blur-2xl rounded-full scale-150 animate-pulse pointer-events-none ${
              variant === 'primary' ? 'bg-brand-primary/10' : 
              variant === 'secondary' ? 'bg-brand-secondary/10' : 'bg-brand-tertiary/10'
            }`} />
          )}
        </button>
      ))}
    </div>
  );
}
