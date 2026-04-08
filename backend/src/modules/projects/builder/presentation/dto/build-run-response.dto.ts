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
import { BuildRunResponseDto } from './build-run-core.dto';

export {
  BuildRunResponseDto,
  CancelBuildRunResponseDto,
  EnqueueBuildRunResponseDto,
  PaginatedBuildRunsResponseDto,
  ReplayBuildRunResponseDto,
} from './build-run-core.dto';
export {
  BuildRunComparisonRequestDto,
  BuildRunComparisonResponseDto,
  ReproducibilityResultDto,
} from './build-run-comparison.dto';
export {
  BuildRunEventDto,
  BuildRunEventsResponseDto,
} from './build-run-events.dto';
export {
  BuildRunReportResponseDto,
  EvidenceArtifactDto,
  EvidenceDownloadUrlDto,
} from './build-run-evidence.dto';

export function toBuildRunResponseDto(run: BuildRun): BuildRunResponseDto {
  return {
    id: run.id,
    deliveryId: run.deliveryId,
    triggeredById: run.triggeredById,
    runKind: run.runKind,
    sourceRunId: run.sourceRunId,
    status: run.status,
    activeStage: run.activeStage,
    latestEventSequence: run.latestEventSequence
      ? Number(run.latestEventSequence)
      : null,
    isTerminal: [
      BuildRunStatus.SUCCESS,
      BuildRunStatus.FAILED,
      BuildRunStatus.CANCELLED,
    ].includes(run.status),
    stackResult: run.stackResult,
    dockerfileContent: run.dockerfileContent,
    buildLogs: run.buildLogs,
    timingsMs: run.timingsMs,
    staticFindings: run.staticFindings,
    stageResults: run.stageResults,
    llmAssessment: run.llmAssessment,
    evidenceArtifacts: run.evidenceArtifacts,
    report: run.report,
    executionContext: run.executionContext,
    reproducibilitySnapshot: run.reproducibilitySnapshot,
    reproducibilityResult: run.reproducibilityResult,
    failureReason: run.failureReason,
    warnings: run.warnings ?? [],
    imageTag: run.imageTag,
    imageExpiresAt: run.imageExpiresAt?.toISOString() ?? null,
    startedAt: run.startedAt?.toISOString() ?? null,
    finishedAt: run.finishedAt?.toISOString() ?? null,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
  };
}
