import {
  RiAwardLine,
  RiCheckboxCircleLine,
  RiTimeLine,
  RiUserSharedLine,
} from "react-icons/ri";
import type { ProjectProgressSummary } from "../../../features/projects/types";

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-app-border bg-white p-6">
      <div className={`text-xl ${color}`}>{icon}</div>
      <div className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
        {value}
      </div>
      <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </div>
    </div>
  );
}

interface ProgressStatsPanelProps {
  summary: ProjectProgressSummary;
}

export function ProgressStatsPanel({
  summary,
}: ProgressStatsPanelProps): JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-6 xl:grid-cols-4">
      <StatCard
        label="Alumnos"
        value={summary.totalAssignments}
        icon={<RiUserSharedLine />}
        color="text-slate-400"
      />
      <StatCard
        label="Han entregado"
        value={summary.deliveredAtLeastOnce}
        icon={<RiCheckboxCircleLine />}
        color="text-primary"
      />
      <StatCard
        label="Con PASS"
        value={summary.passedAllTests}
        icon={<RiAwardLine />}
        color="text-emerald-500"
      />
      <StatCard
        label="Pendientes"
        value={summary.neverDelivered}
        icon={<RiTimeLine />}
        color="text-rose-400"
      />
    </div>
  );
}
