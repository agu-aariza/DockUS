/**
 * @fileoverview Componente de monitorización de ejecuciones SSE en vivo (TimelinePanel).
 *
 * @module TimelinePanel
 */

import type { BuildRunEvent } from "../../../features/builder/types";
import { pretty } from "../../../shared/utils/errors";
import { cn } from "./liveRunUtils";
import {
  classifyTimelineEvent,
  TIMELINE_NODE_CLASS,
  type TimelineEventKind,
} from "./timelineEvent";

interface TimelinePanelProps {
  events: BuildRunEvent[];
}

/** Hora del reloj del sistema: la traza se lee por instantes, no por fechas. */
function formatClock(value?: string | null): string {
  if (!value) return "--:--:--";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "--:--:--"
    : date.toLocaleTimeString("es-ES", { hour12: false });
}

/**
 * La traza del run: un raíl cronológico donde cada evento es un nodo. Es el elemento
 * característico del builder, así que aquí se gasta la atención y el resto se calla.
 */
export function TimelinePanel({ events }: TimelinePanelProps): JSX.Element {
  return (
    <section className="min-w-0 rounded-lg border border-app-border bg-white">
      <header className="border-b border-app-border px-5 py-4">
        <div className="accent-rule mb-2" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-slate-900">Traza de la ejecución</h3>
        <p className="mt-0.5 text-sm text-slate-500">
          Eventos persistidos fuera del stream de consola.
        </p>
      </header>

      {events.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-slate-500">
          Todavía no hay eventos. Aparecerán aquí conforme avance el run.
        </p>
      ) : (
        <ol className="custom-scrollbar max-h-[520px] overflow-y-auto px-5 py-4">
          {events.map((event, index) => (
            <TimelineNode
              key={event.id}
              event={event}
              isLast={index === events.length - 1}
            />
          ))}
        </ol>
      )}
    </section>
  );
}

function TimelineNode({
  event,
  isLast,
}: {
  event: BuildRunEvent;
  isLast: boolean;
}): JSX.Element {
  const { kind, isEvidence, isError, cleanMessage, evidenceContent } =
    classifyTimelineEvent(event);

  return (
    <li className="relative flex gap-4 pb-5 last:pb-0">
      {/* El raíl: une los nodos y se corta en el último. */}
      {!isLast && (
        <span
          className="absolute left-[5px] top-3 h-full w-px bg-app-border"
          aria-hidden="true"
        />
      )}
      <span
        className={cn(
          "relative z-10 mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-white",
          TIMELINE_NODE_CLASS[kind],
        )}
        aria-hidden="true"
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span
            className={cn(
              "truncate font-mono text-xs font-medium uppercase tracking-wide",
              labelToneClass(kind),
            )}
          >
            {isEvidence ? "Evidencia verificada" : event.eventType}
          </span>
          <time className="data-meta shrink-0 text-slate-400">
            {formatClock(event.createdAt)}
          </time>
        </div>

        <p
          className={cn(
            "mt-1 text-sm leading-relaxed",
            isError ? "text-danger" : "text-slate-600",
          )}
        >
          {cleanMessage}
        </p>

        {isEvidence && evidenceContent && (
          <pre className="custom-scrollbar mt-2 max-w-full overflow-x-auto rounded-md bg-slate-950 p-3 font-mono text-xs leading-5 text-success-300">
            {evidenceContent.trim()}
          </pre>
        )}

        {event.payload && !isEvidence && (
          <details className="mt-2">
            <summary className="ui-label cursor-pointer list-none text-slate-400 hover:text-accent">
              Ver payload
            </summary>
            <pre className="custom-scrollbar mt-1.5 max-w-full overflow-x-auto rounded-md bg-slate-950 p-3 font-mono text-xs leading-5 text-slate-300">
              {pretty(event.payload)}
            </pre>
          </details>
        )}
      </div>
    </li>
  );
}

function labelToneClass(kind: TimelineEventKind): string {
  switch (kind) {
    case "evidence":
    case "success":
      return "text-success";
    case "error":
      return "text-danger";
    case "ia":
      return "text-accent";
    default:
      return "text-slate-500";
  }
}
