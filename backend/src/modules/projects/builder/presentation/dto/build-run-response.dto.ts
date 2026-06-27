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
    status: run.status,
    latestEventSequence: run.latestEventSequence
      ? Number(run.latestEventSequence)
      : null,
    isTerminal: [
      BuildRunStatus.SUCCESS,
      BuildRunStatus.FAILED,
      BuildRunStatus.CANCELLED,
    ].includes(run.status),
    llmAssessment: run.llmAssessment,
    report: run.report,
    failureReason: run.failureReason,
    warnings: run.warnings ?? [],
    startedAt: run.startedAt?.toISOString() ?? null,
    finishedAt: run.finishedAt?.toISOString() ?? null,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
  };
}
