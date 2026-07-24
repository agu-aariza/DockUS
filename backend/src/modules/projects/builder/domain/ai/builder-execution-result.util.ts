/**
 * @fileoverview Motor Builder de evaluación asíncrona (builder-execution-result.util).
 *
 * @module builder-execution-result.util
 */

import { BuilderExecutionResult } from '../builder.types';

/**
 * Único punto que convierte un `BuilderExecutionResult` estructurado al texto
 * `STDOUT:\n...\nSTDERR:\n...\nEXIT CODE: n` que consumen los prompts y el
 * feedback pedagógico (audit/04 ARQ-012). Los consumidores que necesitan
 * distinguir semánticamente "no corrió" de "corrió y falló" deben trabajar
 * contra el objeto estructurado, no contra este texto.
 */
export function serializeExecutionResult(
  result: BuilderExecutionResult,
): string {
  if (!result.ran) {
    return `EL LLM DETERMINO QUE EL PROYECTO NO ES EJECUTABLE (${result.skippedReason ?? 'RECETA VACIA'}).`;
  }
  return `STDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}\nEXIT CODE: ${result.exitCode}`;
}
