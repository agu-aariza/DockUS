import {
  RiCalendarLine,
  RiErrorWarningLine,
  RiFileListLine,
  RiFlagLine,
} from "react-icons/ri";
import type { BuildRunEntity, BuilderOutcome } from "../../../features/builder/types";
import { MarkdownContent } from "../MarkdownContent";
import { ReportCard } from "./ReportCard";
import { OutcomeBadge } from "./OutcomeBadge";

interface ReportHeaderProps {
  run: BuildRunEntity;
  deliveryVersion?: number;
  mode?: "student" | "teacher";
}

function resolveOutcome(report: BuildRunEntity["report"], status: BuildRunEntity["status"]): BuilderOutcome {
  if (report?.overallOutcome) {
    return report.overallOutcome;
  }

  if (status === "SUCCESS") return "PASS";
  if (status === "FAILED") return "FAIL";
  return "UNKNOWN";
}

export function ReportHeader({
  run,
  deliveryVersion,
  mode = "teacher",
}: ReportHeaderProps): JSX.Element {
  const report = run.report ?? {};
  const outcome = resolveOutcome(run.report, run.status);
  const finishedAt = run.finishedAt
    ? new Date(run.finishedAt).toLocaleString("es-ES")
    : "—";

  return (
    <ReportCard tone="default" className="overflow-hidden">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Resultado final
              </p>
              <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
                <OutcomeBadge outcome={outcome} className="text-sm" />
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              {deliveryVersion ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-app-border bg-slate-50 px-2.5 py-1 font-semibold">
                  <RiFileListLine aria-hidden="true" />
                  Entrega v{deliveryVersion}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1 rounded-full border border-app-border bg-slate-50 px-2.5 py-1 font-semibold">
                <RiCalendarLine aria-hidden="true" />
                {finishedAt}
              </span>
              {run.failureReason ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 font-semibold text-rose-700">
                  <RiErrorWarningLine aria-hidden="true" />
                  {run.failureReason}
                </span>
              ) : null}
            </div>
          </div>

          {report.professionalVerdict ? (
            <div className="rounded-xl border border-app-border bg-slate-50/70 p-4 text-sm leading-6 text-slate-700">
              <MarkdownContent content={report.professionalVerdict} />
            </div>
          ) : null}

          {report.learningObjective ? (
            <div className="flex items-start gap-2 rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 text-sm text-indigo-900">
              <RiFlagLine className="mt-0.5 shrink-0 text-indigo-600" aria-hidden="true" />
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-700">
                  Objetivo de aprendizaje
                </span>
                <p className="mt-1 font-medium">{report.learningObjective}</p>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {mode === "student" ? (
        <p className="mt-4 text-sm font-medium text-slate-600">
          {outcome === "PASS"
            ? "Tu entrega cumple con los requisitos esenciales evaluados."
            : outcome === "FAIL"
              ? "La entrega sigue bloqueada o no pudo validarse como aprobada."
              : outcome === "PARTIAL"
                ? "Hay evidencia positiva, pero todavía quedan correcciones importantes."
                : "El sistema no pudo producir un resultado concluyente para esta versión."}
        </p>
      ) : null}
    </ReportCard>
  );
}
