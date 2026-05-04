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
  // Variant is ignored in Academic style to maintain a unified scholarly look,
  // but kept in props for backward compatibility
  
  return (
    <div className={`flex border-b border-academic-surface-variant ${className}`}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            className={`group relative flex items-center gap-2 px-6 py-3 text-sm font-semibold transition-colors ${
              isActive 
                ? 'text-academic-primary border-b-2 border-academic-primary' 
                : 'text-academic-on-surface-variant hover:text-academic-on-surface hover:bg-academic-surface-container-lowest'
            }`}
            onClick={() => {
              onTabChange(tab.id);
              if (tab.onClick) tab.onClick();
            }}
          >
            {tab.icon && (
              <span className={`text-lg transition-transform ${isActive ? 'text-academic-primary' : 'text-academic-outline'}`}>
                {typeof tab.icon === 'function' ? React.createElement(tab.icon as React.ElementType) : tab.icon}
              </span>
            )}
            {tab.label}
            {tab.badge && (
              <span className={`ml-2 flex h-2 w-2 rounded-full ${isActive ? 'bg-academic-primary' : 'bg-academic-outline'}`} />
            )}
          </button>
        );
      })}
    </div>
  );
}
