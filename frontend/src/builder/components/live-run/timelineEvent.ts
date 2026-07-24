/**
 * @fileoverview Componente de monitorización de ejecuciones SSE en vivo (timelineEvent).
 *
 * @module timelineEvent
 */

import type { BuildRunEvent } from "../../../features/builder/types";

const EVIDENCE_MARKER = "--- HEALTHCHECK EVIDENCE ---";

export type TimelineEventKind =
  | "evidence"
  | "error"
  | "success"
  | "ia"
  | "system"
  | "default";

export interface ClassifiedTimelineEvent {
  kind: TimelineEventKind;
  isEvidence: boolean;
  isError: boolean;
  isIA: boolean;
  cleanMessage: string;
  evidenceContent: string | null;
}

export function classifyTimelineEvent(
  event: BuildRunEvent,
): ClassifiedTimelineEvent {
  const message = event.message;
  const lowered = message.toLowerCase();

  const isEvidence = message.includes(EVIDENCE_MARKER);
  const evidenceMatch = message.match(
    /--- HEALTHCHECK EVIDENCE ---\n([\s\S]*)/,
  );
  const evidenceContent = evidenceMatch ? evidenceMatch[1] : null;
  const cleanMessage = isEvidence
    ? message.split(EVIDENCE_MARKER)[0].trim()
    : message;

  const isError =
    event.eventType.includes("ERROR") ||
    lowered.includes("error") ||
    lowered.includes("failed");
  const isSuccess =
    event.eventType.includes("COMPLETED") || event.eventType.includes("SUCCESS");
  const isSystem =
    event.eventType.includes("START") || event.eventType.includes("ENQUEUED");
  const isIA = message.includes("IA") || message.includes("LLM");

  let kind: TimelineEventKind = "default";
  if (isEvidence) kind = "evidence";
  else if (isError) kind = "error";
  else if (isSuccess) kind = "success";
  else if (isIA) kind = "ia";
  else if (isSystem) kind = "system";

  return { kind, isEvidence, isError, isIA, cleanMessage, evidenceContent };
}

/** Color del nodo en el raíl de la traza. El tipo de evento es la única señal cromática. */
export const TIMELINE_NODE_CLASS: Record<TimelineEventKind, string> = {
  evidence: "bg-success",
  success: "bg-success",
  error: "bg-danger",
  ia: "bg-accent",
  system: "bg-primary",
  default: "bg-slate-300",
};
