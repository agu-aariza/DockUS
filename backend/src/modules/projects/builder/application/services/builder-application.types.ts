/**
 * @fileoverview Tipos públicos de la capa de aplicación del builder.
 *
 * Contexto:
 * - Agrupa contratos compartidos entre controller, service y processor.
 * - Evita que las capas superiores dependan de detalles internos del pipeline.
 *
 * @module BuilderApplicationTypes
 */

import { PaginationMeta } from '../../../../../shared/utils/pagination.util';
import type { AuthenticatedUser } from '../../../../auth/interfaces/authenticated-user.interface';
import {
  BuildRun,
  BuildRunStatus,
} from '../../domain/entities/build-run.entity';
import {
  BuilderCodeQualityContractV2,
  BuilderEvaluationContractV2,
  BuilderPlanContractV2,
  BuilderReportEntity,
} from '../../domain/builder.types';

export interface EnqueueBuildRunResponse {
  buildRunId: string;
  status: BuildRunStatus;
  deliveryId: string;
}

export interface ExecuteBuildRunJobData {
  buildRunId: string;
  deliveryId: string;
  actor: AuthenticatedUser;
}

export interface BuilderPipelineResult {
  planAssessment: BuilderPlanContractV2;
  assessment: BuilderEvaluationContractV2;
  qualityFindings: BuilderCodeQualityContractV2;
  report: BuilderReportEntity;
  executionLogs: string;
  /** Avisos acumulados durante la preparación del workspace y las etapas. */
  warnings: string[];
}

export interface PaginatedBuildRunsResponse {
  data: BuildRun[];
  meta: PaginationMeta;
}
