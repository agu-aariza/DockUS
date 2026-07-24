import {
  RiAlarmWarningLine,
  RiInformationLine,
  RiLightbulbFlashLine,
} from "react-icons/ri";
import type { TechnicalFeedbackSeverity, TechnicalFeedbackLevel } from "../../../features/builder/types";

interface SeverityBadgeProps {
  severity: TechnicalFeedbackSeverity;
  level?: TechnicalFeedbackLevel;
  className?: string;
}

const SEVERITY_CONFIG: Record<
  TechnicalFeedbackSeverity,
  {
    label: string;
    icon: typeof RiAlarmWarningLine;
    badge: string;
  }
> = {
  high: {
    label: "Severidad alta",
    icon: RiAlarmWarningLine,
    badge: "border-rose-200 bg-rose-50 text-rose-700",
  },
  medium: {
    label: "Severidad media",
    icon: RiInformationLine,
    badge: "border-warning-200 bg-warning-50 text-warning-700",
  },
  low: {
    label: "Severidad baja",
    icon: RiLightbulbFlashLine,
    badge: "border-sky-200 bg-sky-50 text-sky-700",
  },
};

export function SeverityBadge({
  severity,
  level,
  className = "",
}: SeverityBadgeProps): JSX.Element {
  const config = SEVERITY_CONFIG[severity] ?? SEVERITY_CONFIG.medium;
  const Icon = config.icon;

  return (
    <span className={`inline-flex flex-wrap items-center gap-2 ${className}`.trim()}>
      <span
        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${config.badge}`}
      >
        <Icon className="text-sm" aria-hidden="true" />
        {config.label}
      </span>
      {level ? (
        <span className="inline-flex rounded-full border border-app-border bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {level}
        </span>
      ) : null}
    </span>
  );
}
