/**
 * @fileoverview Veredicto profesional del informe Builder (ProfessionalVerdict).
 *
 * @module ProfessionalVerdict
 */

import { RiBriefcaseLine } from "react-icons/ri";
import { MarkdownContent } from "../../shared/components/MarkdownContent";
import type { BuilderOutcome } from "../../features/builder/types";
import { ReportCard } from "./report/ReportCard";
import { OutcomeBadge } from "./report/OutcomeBadge";

interface ProfessionalVerdictProps {
  verdict?: string;
  outcome?: BuilderOutcome;
}

export function ProfessionalVerdict({
  verdict,
  outcome = "UNKNOWN",
}: ProfessionalVerdictProps): JSX.Element | null {
  if (!verdict?.trim()) {
    return null;
  }

  return (
    <ReportCard
      tone="slate"
      icon={RiBriefcaseLine}
      title="Veredicto profesional"
      description="Resumen ejecutivo de la evaluación"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <OutcomeBadge outcome={outcome} />
      </div>

      <div className="mt-5 rounded-xl border border-app-border bg-slate-50/70 p-4 text-sm leading-6 text-slate-700">
        <MarkdownContent content={verdict} />
      </div>
    </ReportCard>
  );
}
