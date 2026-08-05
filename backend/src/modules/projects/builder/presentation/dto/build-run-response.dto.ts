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
    // El contrato LLM completo (thought/rationale/teacherSummary) y
    // report.teacherHighlights son material interno/docente: nunca deben
    // cruzar al rol STUDENT.
    llmAssessment: isStaff ? run.llmAssessment : undefined,
    report: redactReportForRole(run.report, isStaff),
    failureReason: run.failureReason,
    warnings: run.warnings,
    startedAt: run.startedAt?.toISOString() ?? null,
    finishedAt: run.finishedAt?.toISOString() ?? null,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
    inputTokens: run.inputTokens,
    outputTokens: run.outputTokens,
    executionCostUsd: Number(run.executionCostUsd) || 0,
  };
}

function redactReportForRole(report: unknown, isStaff: boolean): unknown {
  if (isStaff || !report || typeof report !== 'object') {
    return report;
  }
  const { teacherHighlights: _teacherHighlights, ...studentSafeReport } =
    report as Record<string, unknown>;
  return studentSafeReport;
}
