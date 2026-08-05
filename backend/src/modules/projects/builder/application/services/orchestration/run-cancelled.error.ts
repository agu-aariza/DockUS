/**
 * @fileoverview Señal de cancelación cooperativa del pipeline.
 *
 * Contexto:
 * - `BuilderRunCancellationService` lanza este error cuando detecta, entre
 * etapas o durante la ejecución Docker, que un docente canceló el run.
 * - No es un fallo del pipeline: `BuilderRunLifecycleService` lo distingue de
 * cualquier otro error y evita marcar el run como FAILED (ya quedó
 * CANCELLED por el UPDATE atómico de `cancelRun`).
 *
 * @module RunCancelledError
 */

export class RunCancelledError extends Error {
  constructor(public readonly buildRunId: string) {
    super(`Run ${buildRunId} cancelado durante el pipeline.`);
    this.name = 'RunCancelledError';
  }
}
