/**
 * @fileoverview Vista y componentes del motor Builder de evaluación (utils).
 *
 * @module utils
 */

import type { BuildRunEvent } from "../features/builder/types";

export function mergeEvents(
  current: BuildRunEvent[],
  incoming: BuildRunEvent[],
): BuildRunEvent[] {
  const byId = new Map(current.map((event) => [event.id, event]));
  incoming.forEach((event) => {
    byId.set(event.id, event);
  });
  return [...byId.values()].sort((left, right) => left.sequence - right.sequence);
}

export function formatDate(value?: string | null): string {
  if (!value) return "n/a";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

