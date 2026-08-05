/**
 * @fileoverview Motor Builder de evaluación asíncrona (builder.constants).
 *
 * @module builder.constants
 */

export const BUILDER_RUNS_QUEUE_NAME = 'builder-runs';
export const BUILDER_RUN_JOB_NAME = 'execute-build-run';

export const DEFAULT_STALE_RUN_THRESHOLD_MS = 600000;
export const DEFAULT_MAX_EXTRACTED_FILES = 1500;
export const DEFAULT_MAX_EXTRACTED_BYTES = 100 * 1024 * 1024;

// las versiones permitidas e imágenes base por defecto
// vivían aquí duplicadas del catálogo de runtimes; ahora solo existen en
// RUNTIME_CATALOG (./runtime-catalog.ts), fuente única de verdad.

/**
 * Prioridades de la cola `builder-runs`.
 *
 * En BullMQ, **menor número = mayor prioridad**. La cola era FIFO estricta, de
 * modo que una avalancha de entregas de alumnos cerca de la fecha límite
 * retrasaba por igual las reejecuciones que lanza un docente para revisar una
 * entrega concreta —que son pocas, interactivas y con alguien esperando delante
 * de la pantalla—.
 *
 * No es un mecanismo de justicia entre alumnos: dentro de cada prioridad se
 * mantiene el orden de llegada, así que ninguna entrega adelanta a otra.
 */
export const BUILDER_JOB_PRIORITY = {
  /** Reejecución lanzada por un docente o administrador. */
  INTERACTIVE: 1,
  /** Entrega de alumno y reencolado de runs huérfanos. */
  BATCH: 2,
} as const;
