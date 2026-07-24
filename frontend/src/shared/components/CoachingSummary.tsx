/**
 * @fileoverview Componente compartido de la interfaz DockUS (CoachingSummary).
 *
 * @module CoachingSummary
 */

import type { BuilderRuntimeFamily, BuilderReportCoaching, TechnicalFeedbackItem } from "../../features/builder/types";
import {
  RiAlertLine,
  RiCheckboxCircleLine,
  RiLightbulbFlashLine,
  RiListCheck3,
  RiSparklingLine,
} from "react-icons/ri";
import { MarkdownContent } from "./MarkdownContent";
import { ReportCard } from "./report/ReportCard";
import { TechnicalFindingCard } from "./report/TechnicalFindingCard";
import { normalizeTechnicalFeedbackItem } from "../utils/technicalFeedback";

interface CoachingSummaryProps {
  coaching: BuilderReportCoaching;
  mode?: "student" | "teacher";
  rubricItems?: TechnicalFeedbackItem[];
  variant?: "full" | "compact";
  runtimeFamily?: BuilderRuntimeFamily;
}

function Checklist({
  entries,
}: {
  entries: string[];
}): JSX.Element {
  return (
    <ol className="space-y-3 text-sm text-slate-700">
      {entries.map((entry, index) => (
        <li
          key={`${entry}-${index}`}
          className="flex gap-3 rounded-xl border border-app-border bg-white p-4"
        >
          <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
            {index + 1}
          </span>
          <div className="min-w-0 flex-1 leading-relaxed">
            <MarkdownContent content={entry} />
          </div>
        </li>
      ))}
    </ol>
  );
}

function FindingList({
  items,
  runtimeFamily,
  variant,
}: {
  items: TechnicalFeedbackItem[];
  runtimeFamily?: BuilderRuntimeFamily;
  variant?: "default" | "compact";
}): JSX.Element {
  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <TechnicalFindingCard
          key={`${item.title}-${index}`}
          item={normalizeTechnicalFeedbackItem(item)}
          runtimeFamily={runtimeFamily}
          variant={variant}
        />
      ))}
    </div>
  );
}

export function CoachingSummary({
  coaching,
  mode = "student",
  rubricItems = [],
  variant = "full",
  runtimeFamily,
}: CoachingSummaryProps): JSX.Element | null {
  const hasContent =
    coaching.mustFix.length > 0 ||
    coaching.shouldImprove.length > 0 ||
    coaching.strengths.length > 0 ||
    coaching.nextAttemptChecklist.length > 0 ||
    rubricItems.length > 0;

  if (!hasContent) {
    return null;
  }

  const blocked = coaching.passReadiness === "BLOCKED";

  if (variant === "compact") {
    return (
      <details className="group rounded-2xl border border-indigo-200 bg-white shadow-sm overflow-hidden">
        <summary className="flex cursor-pointer list-none items-start gap-3 p-5 select-none hover:bg-slate-50/50">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <RiListCheck3 className="text-xl" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600/80">
              Antes de subir una nueva versión
            </p>
            <h3 className="mt-1 text-sm font-semibold tracking-tight text-slate-900 pr-6 relative">
              {blocked
                ? "Debes corregir esto antes de pasar en el siguiente intento."
                : "Tu entrega ya funciona, pero aún puedes mejorarla antes de la siguiente versión."}
            </h3>
          </div>
          <span className="text-slate-400 transition-transform group-open:rotate-180 text-lg mt-2">
            ▼
          </span>
        </summary>

        <div className="border-t border-indigo-100 p-5 bg-slate-50/20 space-y-4">
          {coaching.mustFix.length > 0 ? (
            <div>
              <div className="mb-2 text-xs font-bold uppercase tracking-wider text-rose-600">
                Debes corregir esto antes de pasar
              </div>
              <FindingList
                items={coaching.mustFix.slice(0, 2)}
                runtimeFamily={runtimeFamily}
                variant="compact"
              />
            </div>
          ) : null}

          {coaching.shouldImprove.length > 0 ? (
            <div>
              <div className="mb-2 text-xs font-bold uppercase tracking-wider text-warning-600">
                Podrías mejorar también
              </div>
              <FindingList
                items={coaching.shouldImprove.slice(0, 2)}
                runtimeFamily={runtimeFamily}
                variant="compact"
              />
            </div>
          ) : null}
        </div>
      </details>
    );
  }

  return (
    <ReportCard
      tone="indigo"
      icon={RiLightbulbFlashLine}
      title={
        mode === "student"
          ? "Cómo mejorar esta entrega"
          : "Orientación para la siguiente versión"
      }
      description={
        blocked
          ? "El sistema ha detectado bloqueos que debes resolver antes de poder pasar esta práctica."
          : "La entrega ya supera lo esencial y estas sugerencias sirven para dejarla más limpia y mantenible."
      }
    >
      <div className="mt-2">
        <span
          className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
            blocked
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-success-200 bg-success-50 text-success-700"
          }`}
        >
          {blocked ? "Pendiente de corrección" : "Lista con mejoras opcionales"}
        </span>
      </div>

      {coaching.mustFix.length > 0 ? (
        <div className="mt-6">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-rose-700">
            <RiAlertLine className="text-base" aria-hidden="true" />
            Qué debes corregir para pasar
          </div>
          <FindingList items={coaching.mustFix} runtimeFamily={runtimeFamily} />
        </div>
      ) : null}

      {coaching.shouldImprove.length > 0 ? (
        <div className="mt-6">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-warning-700">
            <RiLightbulbFlashLine className="text-base" aria-hidden="true" />
            Qué podrías mejorar aunque ya funcione
          </div>
          <FindingList
            items={coaching.shouldImprove}
            runtimeFamily={runtimeFamily}
          />
        </div>
      ) : null}

      {coaching.strengths.length > 0 ? (
        <div className="mt-6">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-success-700">
            <RiSparklingLine className="text-base" aria-hidden="true" />
            Qué has hecho bien
          </div>
          <FindingList items={coaching.strengths} runtimeFamily={runtimeFamily} />
        </div>
      ) : null}

      {rubricItems.length > 0 ? (
        <div className="mt-6">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-fuchsia-700">
            <RiCheckboxCircleLine className="text-base" aria-hidden="true" />
            Cumplimiento de rúbrica
          </div>
          <FindingList items={rubricItems} runtimeFamily={runtimeFamily} />
        </div>
      ) : null}

      {coaching.nextAttemptChecklist.length > 0 ? (
        <div className="mt-6">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-700">
            <RiListCheck3 className="text-base" aria-hidden="true" />
            Checklist para la siguiente versión
          </div>
          <Checklist entries={coaching.nextAttemptChecklist} />
        </div>
      ) : null}
    </ReportCard>
  );
}
