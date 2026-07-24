/**
 * @fileoverview Componente compartido de la interfaz DockUS (TeacherHighlights).
 *
 * @module TeacherHighlights
 */

import {
  RiAlarmWarningLine,
  RiCheckLine,
  RiClipboardLine,
  RiListCheck3,
} from "react-icons/ri";
import { MarkdownContent } from "./MarkdownContent";
import type { BuilderTeacherHighlights } from "../../features/builder/types";
import { ReportCard } from "./report/ReportCard";

interface TeacherHighlightsProps {
  highlights: BuilderTeacherHighlights;
}

export function TeacherHighlights({
  highlights,
}: TeacherHighlightsProps): JSX.Element | null {
  const hasContent =
    highlights.strengths.length > 0 ||
    highlights.concerns.length > 0 ||
    highlights.followUp.length > 0;

  if (!hasContent) {
    return null;
  }

  return (
    <ReportCard
      tone="indigo"
      icon={RiClipboardLine}
      title="Orientación docente"
      description="Puntos clave para la revisión"
    >
      <div className="grid gap-4 lg:grid-cols-3">
        {highlights.strengths.length > 0 ? (
          <article className="rounded-xl border border-app-border border-t-4 border-t-emerald-500 bg-white p-4">
            <div className="flex items-center gap-2 text-success-700">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-success-50">
                <RiCheckLine className="text-sm" aria-hidden="true" />
              </div>
              <h4 className="text-xs font-bold uppercase tracking-wider">
                Fortalezas
              </h4>
            </div>
            <ul className="mt-3 list-disc space-y-2 pl-4 text-sm leading-6 text-slate-700">
              {highlights.strengths.map((item, index) => (
                <li key={`strength-${index}`}>
                  <MarkdownContent content={item} />
                </li>
              ))}
            </ul>
          </article>
        ) : null}

        {highlights.concerns.length > 0 ? (
          <article className="rounded-xl border border-app-border border-t-4 border-t-rose-500 bg-white p-4">
            <div className="flex items-center gap-2 text-rose-700">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-rose-50">
                <RiAlarmWarningLine className="text-sm" aria-hidden="true" />
              </div>
              <h4 className="text-xs font-bold uppercase tracking-wider">
                Preocupaciones
              </h4>
            </div>
            <ul className="mt-3 list-disc space-y-2 pl-4 text-sm leading-6 text-slate-700">
              {highlights.concerns.map((item, index) => (
                <li key={`concern-${index}`}>
                  <MarkdownContent content={item} />
                </li>
              ))}
            </ul>
          </article>
        ) : null}

        {highlights.followUp.length > 0 ? (
          <article className="rounded-xl border border-app-border border-t-4 border-t-amber-500 bg-white p-4">
            <div className="flex items-center gap-2 text-warning-700">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-warning-50">
                <RiListCheck3 className="text-sm" aria-hidden="true" />
              </div>
              <h4 className="text-xs font-bold uppercase tracking-wider">
                Seguimiento
              </h4>
            </div>
            <ul className="mt-3 list-disc space-y-2 pl-4 text-sm leading-6 text-slate-700">
              {highlights.followUp.map((item, index) => (
                <li key={`followup-${index}`}>
                  <MarkdownContent content={item} />
                </li>
              ))}
            </ul>
          </article>
        ) : null}
      </div>
    </ReportCard>
  );
}
