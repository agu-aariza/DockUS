import React from 'react';
import { MetricCard } from '../MetricCard';

export interface StatItem {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  helper?: string;
  variant?: 'default' | 'warning' | 'success' | 'info' | 'dark';
}

interface StatsOverviewProps {
  stats: StatItem[];
  columns?: 2 | 3 | 4;
  className?: string;
}

const columnClass = {
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-2 xl:grid-cols-4',
};

export function StatsOverview({ stats, columns = 4, className = '' }: StatsOverviewProps): JSX.Element {
  return (
    <div className={`grid grid-cols-1 gap-4 ${columnClass[columns]} ${className}`}>
      {stats.map((stat, index) => (
        <MetricCard
          key={index}
          label={stat.label}
          value={stat.value}
          helper={stat.helper}
          icon={stat.icon}
          variant={stat.variant ?? 'default'}
        />
      ))}
    </div>
  );
}
