/**
 * @fileoverview Motor Builder de evaluación asíncrona (builder-hallucination-guard.service).
 *
 * @module builder-hallucination-guard.service
 */

import { Injectable } from '@nestjs/common';
import {
  BuilderEvaluationContractV2,
  BuilderExecutionResult,
} from '../../../domain/builder.types';

@Injectable()
export class BuilderHallucinationGuard {
  /**
   * Detects when the eval LLM likely hallucinated program output.
   * Checks if execution logs only contain build artifacts (gcc, make)
   * with no actual program output, yet the assessment claims success.
   *
   * opera sobre el `BuilderExecutionResult` estructurado, no sobre
   * el blob de texto `STDOUT:/STDERR:/EXIT CODE`. Antes esta clase tenía que
   * re-parsear ese formato con regex (incluida una extracción de stdout que
   * dependía de que nadie cambiara el formato del blob); con el resultado
   * tipado, `stdout`/`stderr` ya vienen separados.
   */
  detectOutputHallucination(
    assessment: BuilderEvaluationContractV2,
    execution: BuilderExecutionResult,
    expectedOutput: string | null,
  ): string | null {
    if (!execution.ran) return null;

    const BUILD_PATTERNS = [
      /^gcc\s/i,
      /^g\+\+\s/i,
      /^make[\s:[]/i,
      /^cc\s/i,
      /^ld\s/i,
      /nothing to be done/i,
    ];

    const combinedOutput = `${execution.stdout}\n${execution.stderr}`;
    const logLines = combinedOutput.split('\n').filter((l) => l.trim());
    const nonBuildLines = logLines.filter((line) => {
      const stripped = line.trim();
      if (!stripped) return false;
      return !BUILD_PATTERNS.some((p) => p.test(stripped));
    });

    // If there are no non-build lines but assessment claims E1 or E2
    if (
      nonBuildLines.length === 0 &&
      assessment.evaluativeState !== 'E3' &&
      assessment.evaluativeState !== 'E4'
    ) {
      return (
        'GUARDRAIL: Los logs solo contienen mensajes de compilacion, sin salida de programa. ' +
        `El evaluador reporto ${assessment.evaluativeState} — posible alucinacion de salida.`
      );
    }

    // If expectedOutput has content but none of its lines appear in execution logs
    if (expectedOutput?.trim() && assessment.evaluativeState === 'E1') {
      const oracleLines = expectedOutput
        .split('\n')
        .filter((l) => l.trim().length > 5);
      if (oracleLines.length > 0) {
        const anyMatch = oracleLines.some((ol) =>
          combinedOutput.includes(ol.trim()),
        );
        if (!anyMatch) {
          return (
            'GUARDRAIL: Ninguna linea del expectedOutput aparece en los logs de ejecucion, ' +
            'pero el evaluador reporto E1.'
          );
        }
      }
    }

    // Check 3: Numeric value mismatch — output has same labels but different numbers
    if (
      expectedOutput?.trim() &&
      (assessment.evaluativeState === 'E1' ||
        assessment.evaluativeState === 'E2')
    ) {
      const actualStdout = execution.stdout.trim();

      // Parse "Salida exacta esperada" section from expectedOutput
      const oracleSalidaMatch = expectedOutput.match(
        /[Ss]alida\s+exacta\s+esperada[^\n]*\n([\s\S]+?)(?:\n\n|$)/,
      );
      const oracleSalida = oracleSalidaMatch?.[1]?.trim();

      if (oracleSalida && actualStdout && oracleSalida !== actualStdout) {
        const extractNumbers = (text: string): number[] =>
          [...text.matchAll(/\b(\d+)\b/g)].map((m) => Number(m[1]));

        const oracleNumbers = extractNumbers(oracleSalida);
        const actualNumbers = extractNumbers(actualStdout);

        if (
          oracleNumbers.length > 0 &&
          actualNumbers.length > 0 &&
          oracleNumbers.length === actualNumbers.length
        ) {
          const allDifferent = oracleNumbers.every(
            (n, i) => n !== actualNumbers[i],
          );
          const actualAllZero = actualNumbers.every((n) => n === 0);

          if (allDifferent || actualAllZero) {
            return (
              'GUARDRAIL: La salida real tiene los mismos labels que el oraculo pero TODOS los valores numericos difieren. ' +
              `Oraculo: [${oracleNumbers.join(', ')}]. Real: [${actualNumbers.join(', ')}]. ` +
              'El evaluador reporto coincidencia — alucinacion confirmada.'
            );
          }
        }
      }
    }

    return null;
  }
}
