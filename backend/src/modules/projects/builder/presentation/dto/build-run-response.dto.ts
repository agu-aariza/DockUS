/**
 * @fileoverview Fachada DTO de salida para ejecuciones del builder.
 *
 * Contexto:
 * - Mantiene un punto de importación estable para controller y Swagger.
 * - Reexporta DTOs segmentados por responsabilidad para evitar un archivo monolítico.
 *
 * @module BuildRunResponseDto
 */

import {
  BuildRun,
  BuildRunStatus,
} from '../../domain/entities/build-run.entity';
import { UserRole } from '../../../../users/entities/user.entity';
import { BuildRunResponseDto } from './build-run-core.dto';
import { buildRunReportSummary } from '../../application/services/evaluation/builder-report-projection.service';

export {
  BuildRunResponseDto,
  CancelBuildRunResponseDto,
  EnqueueBuildRunResponseDto,
  PaginatedBuildRunsResponseDto,
} from './build-run-core.dto';
export { BuildRunEventsResponseDto } from './build-run-events.dto';
export {
  EvidenceArtifactDto,
  EvidenceDownloadUrlDto,
} from './build-run-evidence.dto';

export function toBuildRunResponseDto(
  run: BuildRun,
  actorRole?: UserRole,
): BuildRunResponseDto {
  const isStaff =
    actorRole === UserRole.ADMIN || actorRole === UserRole.TEACHER;
  const warnings = isStaff
    ? run.warnings
    : run.warnings.map(sanitizeStudentRunText).filter(Boolean);
  return {
    id: run.id,
    deliveryId: run.deliveryId,
    triggeredById: run.triggeredById,
    status: run.status,
    latestEventSequence: run.latestEventSequence
      ? Number(run.latestEventSequence)
      : null,
    isTerminal: [
      BuildRunStatus.SUCCESS,
      BuildRunStatus.FAILED,
      BuildRunStatus.CANCELLED,
    ].includes(run.status),
    // El contrato de evaluación completo sigue siendo exclusivamente docente.
    llmAssessment: isStaff ? run.llmAssessment : undefined,
    reportSummary: buildRunReportSummary(run),
    failureReason:
      isStaff || !run.failureReason
        ? run.failureReason
        : 'La evaluación no pudo completarse. Revisa el estado del run o consulta con tu profesor.',
    warnings,
    startedAt: run.startedAt?.toISOString() ?? null,
    finishedAt: run.finishedAt?.toISOString() ?? null,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
    inputTokens: run.inputTokens,
    outputTokens: run.outputTokens,
    executionCostUsd: Number(run.executionCostUsd) || 0,
  };
}

function sanitizeStudentRunText(value: string): string {
  return value
    .split(/\r?\n/u)
    .filter(
      (line) =>
        !/(?:hidden|oculto|oracle|oráculo|teacher[ _-]?test|test docente|prompt|secret)/iu.test(
          line,
        ),
    )
    .join('\n')
    .trim();
}
