import type {
  BuilderRuntimeFamily,
  BuilderReportCoaching,
  TechnicalFeedbackItem,
} from "../types";
import {
  RiAlertLine,
  RiAlarmWarningLine,
  RiCheckboxCircleLine,
  RiInformationLine,
  RiListCheck3,
  RiLightbulbFlashLine,
  RiSparklingLine,
} from "react-icons/ri";
import { CodeSnippet } from "./CodeSnippet";
import { MarkdownContent } from "./MarkdownContent";
import { normalizeTechnicalFeedbackItem } from "../utils/technicalFeedback";

interface CoachingSummaryProps {
  coaching: BuilderReportCoaching;
  mode?: "student" | "teacher";
  rubricItems?: TechnicalFeedbackItem[];
  variant?: "full" | "compact";
  runtimeFamily?: BuilderRuntimeFamily;
}

const SEVERITY_UI = {
  high: {
    label: "Severidad alta",
    icon: RiAlarmWarningLine,
    badge: "border-rose-200 bg-rose-50 text-rose-700",
  },
  medium: {
    label: "Severidad media",
    icon: RiInformationLine,
    badge: "border-amber-200 bg-amber-50 text-amber-700",
  },
  low: {
    label: "Severidad baja",
    icon: RiLightbulbFlashLine,
    badge: "border-sky-200 bg-sky-50 text-sky-700",
  },
} as const;

function FeedbackList({
  items,
  runtimeFamily,
}: {
  items: TechnicalFeedbackItem[];
  runtimeFamily?: BuilderRuntimeFamily;
}): JSX.Element {
  const normalizedItems = items.map((item) => normalizeTechnicalFeedbackItem(item));

  return (
    <div className="space-y-3">
      {normalizedItems.map((item, index) => (
        <article
          key={`${item.title}-${index}`}
          className="rounded-2xl border border-slate-200 bg-white p-4 text-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="font-semibold text-slate-900">{item.title}</div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${SEVERITY_UI[item.severity].badge}`}
              >
                {(() => {
                  const Icon = SEVERITY_UI[item.severity].icon;
                  return <Icon className="text-sm" aria-hidden="true" />;
                })()}
                {SEVERITY_UI[item.severity].label}
              </span>
              <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                {item.level}
              </span>
            </div>
          </div>
          <div className="mt-2 text-slate-700">
            <MarkdownContent content={item.detail} />
          </div>
          {item.file ? (
            <div className="mt-2 inline-block rounded bg-slate-50 px-2 py-1 font-mono text-xs text-slate-500">
              {item.file}
              {item.line ? `:${item.line}` : ""}
            </div>
          ) : null}
          <CodeSnippet code={item.codeSnippet} runtimeFamily={runtimeFamily} />
          {item.conceptExplanation.trim() ? (
            <details className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <summary className="cursor-pointer text-sm font-semibold text-brand-blue">
                Aprende mas
              </summary>
              <div className="mt-3 text-slate-700">
                <MarkdownContent content={item.conceptExplanation} />
              </div>
            </details>
          ) : null}
        </article>
      ))}
    </div>
  );
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
          className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4"
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
      <section className="rounded-3xl border border-indigo-200 bg-indigo-50 p-5 shadow-sm">
        <div className="flex items-center gap-2 text-indigo-800">
          <RiListCheck3 className="text-lg" />
          <h3 className="text-sm font-bold uppercase tracking-[0.16em]">
            Antes de subir una nueva version
          </h3>
        </div>
        <p className="mt-3 text-sm leading-6 text-indigo-900">
          {blocked
            ? "Debes corregir esto antes de pasar en el siguiente intento."
            : "Tu entrega ya funciona, pero aun puedes mejorarla antes de la siguiente version."}
        </p>

        {coaching.mustFix.length > 0 ? (
          <div className="mt-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-rose-700">
              Debes corregir esto antes de pasar
            </div>
            <FeedbackList
              items={coaching.mustFix.slice(0, 2)}
              runtimeFamily={runtimeFamily}
            />
          </div>
        ) : null}

        {coaching.shouldImprove.length > 0 ? (
          <div className="mt-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
              Podrias mejorar tambien
            </div>
            <FeedbackList
              items={coaching.shouldImprove.slice(0, 2)}
              runtimeFamily={runtimeFamily}
            />
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-indigo-200 bg-indigo-50 p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-indigo-800">
            <RiLightbulbFlashLine className="text-xl" />
            <h3 className="text-sm font-bold uppercase tracking-[0.16em]">
              {mode === "student"
                ? "Como mejorar esta entrega"
                : "Orientacion para la siguiente version"}
            </h3>
          </div>
          <p className="mt-3 text-sm leading-6 text-indigo-900">
            {blocked
              ? "El sistema ha detectado bloqueos que debes resolver antes de poder pasar esta practica."
              : "La entrega ya supera lo esencial y estas sugerencias sirven para dejarla mas limpia y mantenible."}
          </p>
        </div>
        <span
          className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
            blocked
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {blocked ? "Pendiente de correccion" : "Lista con mejoras opcionales"}
        </span>
      </div>

      {coaching.mustFix.length > 0 ? (
        <div className="mt-6">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-rose-700">
            <RiAlertLine className="text-base" />
            Que debes corregir para pasar
          </div>
          <FeedbackList items={coaching.mustFix} runtimeFamily={runtimeFamily} />
        </div>
      ) : null}

      {coaching.shouldImprove.length > 0 ? (
        <div className="mt-6">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">
            <RiLightbulbFlashLine className="text-base" />
            Que podrias mejorar aunque ya funcione
          </div>
          <FeedbackList
            items={coaching.shouldImprove}
            runtimeFamily={runtimeFamily}
          />
        </div>
      ) : null}

      {coaching.strengths.length > 0 ? (
        <div className="mt-6">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">
            <RiSparklingLine className="text-base" />
            Que has hecho bien
          </div>
          <FeedbackList items={coaching.strengths} runtimeFamily={runtimeFamily} />
        </div>
      ) : null}

      {rubricItems.length > 0 ? (
        <div className="mt-6">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-fuchsia-700">
            <RiCheckboxCircleLine className="text-base" />
            Cumplimiento de rubrica
          </div>
          <FeedbackList items={rubricItems} runtimeFamily={runtimeFamily} />
        </div>
      ) : null}

      {coaching.nextAttemptChecklist.length > 0 ? (
        <div className="mt-6">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-slate-700">
            <RiListCheck3 className="text-base" />
            Checklist para la siguiente version
          </div>
          <Checklist entries={coaching.nextAttemptChecklist} />
        </div>
      ) : null}
    </section>
  );
}
