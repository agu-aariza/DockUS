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
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300"
        >
          <div className="mb-4 flex items-center justify-between">
            <span className="rounded-xl bg-slate-100 p-2 text-slate-600">
              {stat.icon}
            </span>
            {stat.trend && (
              <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                {stat.trend}
              </span>
            )}
          </div>
          <div>
            <span className="mb-1 block text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
              {stat.label}
            </span>
            <div className="text-2xl font-semibold tracking-tight text-slate-950">
              {stat.value}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
