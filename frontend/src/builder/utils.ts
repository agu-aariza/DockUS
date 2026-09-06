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
  if (incoming.length === 0) return current;
  if (current.length === 0) {
    if (incoming.length === 1) return [incoming[0]];
    const byId = new Map(incoming.map((event) => [event.id, event]));
    return [...byId.values()].sort((left, right) => left.sequence - right.sequence);
  }

  // Optimización O(1) para el flujo principal de streaming SSE (evento único secuencial)
  if (incoming.length === 1) {
    const event = incoming[0];
    const last = current[current.length - 1];

    if (last && event.sequence > last.sequence) {
      let isDuplicate = false;
      for (let i = current.length - 1; i >= 0; i--) {
        if (current[i].id === event.id) {
          isDuplicate = true;
          const next = [...current];
          next[i] = event;
          return next;
        }
      }
      if (!isDuplicate) {
        return [...current, event];
      }
    }

    // Caso de actualización del último evento recibido
    if (last && last.id === event.id) {
      const next = [...current];
      next[next.length - 1] = event;
      return next;
    }

    // Caso de evento existente o fuera de secuencia
    const existingIndex = current.findIndex((e) => e.id === event.id);
    if (existingIndex !== -1) {
      const next = [...current];
      next[existingIndex] = event;
      const prevSeq = existingIndex > 0 ? next[existingIndex - 1].sequence : -Infinity;
      const nextSeq = existingIndex < next.length - 1 ? next[existingIndex + 1].sequence : Infinity;
      if (event.sequence >= prevSeq && event.sequence <= nextSeq) {
        return next;
      }
      return next.sort((left, right) => left.sequence - right.sequence);
    }

    // Inserción ordenada directa de evento nuevo fuera de orden
    let insertIdx = current.length;
    for (let i = 0; i < current.length; i++) {
      if (current[i].sequence > event.sequence) {
        insertIdx = i;
        break;
      }
    }
    const next = [...current];
    next.splice(insertIdx, 0, event);
    return next;
  }

  // Caso general para lotes múltiples (ej. snapshot inicial)
  const byId = new Map(current.map((event) => [event.id, event]));
  for (const event of incoming) {
    byId.set(event.id, event);
  }
  return [...byId.values()].sort((left, right) => left.sequence - right.sequence);
}

export function formatDate(value?: string | null): string {
  if (!value) return "n/a";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

