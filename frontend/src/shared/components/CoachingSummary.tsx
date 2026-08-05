/**
 * @fileoverview Componente compartido de la interfaz EduCodeAI (CoachingSummary).
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
import {
  groupFindingsByLocation,
  normalizeTechnicalFeedbackItem,
} from "../utils/technicalFeedback";

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
  tone = "finding",
}: {
  items: TechnicalFeedbackItem[];
  runtimeFamily?: BuilderRuntimeFamily;
  variant?: "default" | "compact";
  tone?: "finding" | "strength";
}): JSX.Element {
  // Varias observaciones sobre el mismo archivo:línea son un solo problema.
  const groups = groupFindingsByLocation(items);

  return (
    <div className="space-y-3">
      {groups.map(({ item, related }, index) => (
        <TechnicalFindingCard
          key={`${item.title}-${index}`}
          item={normalizeTechnicalFeedbackItem(item)}
          runtimeFamily={runtimeFamily}
          variant={variant}
          related={related}
          tone={tone}
        />
      ))}
    </div>
  );
}

/** Clave estable de un hallazgo para no repetirlo entre secciones. */
function findingKey(item: TechnicalFeedbackItem): string {
  return [item.title, item.file ?? "", item.line ?? ""].join("|");
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
  const isStudent = mode === "student";

  // La rúbrica se mostraba entera aunque sus hallazgos ya estuviesen arriba: el
  // alumno veía el mismo bloqueo dos veces y contado tres en el checklist.
  const shownKeys = new Set(
    [...coaching.mustFix, ...coaching.shouldImprove].map((item) =>
      findingKey(item),
    ),
  );
  const pendingRubricItems = rubricItems.filter(
    (item) => !shownKeys.has(findingKey(item)),
  );

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
        isStudent
          ? "Cómo mejorar esta entrega"
          : "Orientación para la siguiente versión"
      }
      description={
        blocked
          ? isStudent
            ? "Estas son las correcciones que bloquean el aprobado. Lo demás son mejoras opcionales."
            : "El alumno tiene correcciones bloqueantes pendientes; el resto son mejoras opcionales."
          : isStudent
            ? "La entrega ya supera lo esencial y estas sugerencias sirven para dejarla más limpia y mantenible."
            : "La entrega supera lo esencial; estas sugerencias sirven para orientar la siguiente versión."
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
            {isStudent
              ? "Qué debes corregir para pasar"
              : "Qué debe corregir para aprobar"}
          </div>
          <FindingList items={coaching.mustFix} runtimeFamily={runtimeFamily} />
        </div>
      ) : null}

      {coaching.shouldImprove.length > 0 ? (
        <div className="mt-6">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-warning-700">
            <RiLightbulbFlashLine className="text-base" aria-hidden="true" />
            {isStudent
              ? "Qué podrías mejorar aunque ya funcione"
              : "Mejoras sugeridas"}
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
            {isStudent ? "Qué has hecho bien" : "Fortalezas detectadas"}
          </div>
          <FindingList
            items={coaching.strengths}
            runtimeFamily={runtimeFamily}
            tone="strength"
          />
        </div>
      ) : null}

      {pendingRubricItems.length > 0 ? (
        <div className="mt-6">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-fuchsia-700">
            <RiCheckboxCircleLine className="text-base" aria-hidden="true" />
            Cumplimiento de rúbrica
          </div>
          <FindingList items={pendingRubricItems} runtimeFamily={runtimeFamily} />
        </div>
      ) : null}

      {coaching.nextAttemptChecklist.length > 0 ? (
        <div className="mt-6">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-700">
            <RiListCheck3 className="text-base" aria-hidden="true" />
            {isStudent
              ? "Checklist para la siguiente versión"
              : "Checklist que verá el alumno"}
          </div>
          <Checklist entries={coaching.nextAttemptChecklist} />
        </div>
      ) : null}
    </ReportCard>
  );
}
