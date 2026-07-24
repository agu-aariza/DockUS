import {
  RiAlertLine,
  RiCheckLine,
  RiCloseLine,
  RiQuestionLine,
} from "react-icons/ri";
import type { BuilderOutcome } from "../../../features/builder/types";

interface OutcomeBadgeProps {
  outcome: BuilderOutcome;
  className?: string;
}

const OUTCOME_CONFIG: Record<
  BuilderOutcome,
  {
    label: string;
    icon: typeof RiCheckLine;
    badge: string;
  }
> = {
  PASS: {
    label: "Apto",
    icon: RiCheckLine,
    badge:
      "border-success-200 bg-success-50 text-success-700",
  },
  FAIL: {
    label: "No apto",
    icon: RiCloseLine,
    badge: "border-rose-200 bg-rose-50 text-rose-700",
  },
  PARTIAL: {
    label: "Necesita mejoras",
    icon: RiAlertLine,
    badge: "border-warning-200 bg-warning-50 text-warning-700",
  },
  UNKNOWN: {
    label: "Sin evaluar",
    icon: RiQuestionLine,
    badge: "border-slate-200 bg-slate-50 text-slate-600",
  },
};

export function OutcomeBadge({
  outcome,
  className = "",
}: OutcomeBadgeProps): JSX.Element {
  const config = OUTCOME_CONFIG[outcome] ?? OUTCOME_CONFIG.UNKNOWN;
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${config.badge} ${className}`.trim()}
    >
      <Icon aria-hidden="true" />
      {config.label}
    </span>
  );
}
