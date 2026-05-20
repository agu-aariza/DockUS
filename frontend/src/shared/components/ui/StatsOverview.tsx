import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  variant?: 'primary' | 'secondary' | 'accent' | 'success';
}

export function StatsOverview({ stats }: { stats: StatCardProps[] }): JSX.Element {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat, i) => (
        <div
          key={i}
          className="rounded-2xl border border-academic-outline/10 bg-white p-5 shadow-academic transition-all hover:border-academic-outline/30 hover:shadow-academic-lg hover:-translate-y-0.5 duration-300"
        >
          <div className="mb-4 flex items-center justify-between">
            <span className="rounded-xl bg-academic-surface-container p-2.5 text-academic-on-surface-variant shadow-sm">
              {stat.icon}
            </span>
            {stat.trend && (
              <span className="rounded-full border border-emerald-500/10 bg-emerald-500/5 px-2.5 py-1 text-xs font-bold text-emerald-700 uppercase tracking-wider">
                {stat.trend}
              </span>
            )}
          </div>
          <div>
            <span className="mb-1 block text-xs font-mono font-bold uppercase tracking-[0.16em] text-academic-on-surface-variant">
              {stat.label}
            </span>
            <div className="text-3xl font-bold tracking-tight text-academic-on-surface">
              {stat.value}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
