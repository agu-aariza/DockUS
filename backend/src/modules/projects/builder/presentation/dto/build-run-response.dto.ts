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
} from './build-run-core.dto';
export {
  BuildRunEventDto,
  BuildRunEventsResponseDto,
} from './build-run-events.dto';
export {
  EvidenceArtifactDto,
  EvidenceDownloadUrlDto,
} from './build-run-evidence.dto';

export function toBuildRunResponseDto(run: BuildRun): BuildRunResponseDto {
  return {
    id: run.id,
    deliveryId: run.deliveryId,
    triggeredById: run.triggeredById,
    runKind: run.runKind,
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
    preflightSummary: run.preflightSummary,
    evidenceArtifacts: run.evidenceArtifacts,
    report: run.report,
    executionContext: run.executionContext,
    runtimeTarget: run.runtimeTarget,
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
