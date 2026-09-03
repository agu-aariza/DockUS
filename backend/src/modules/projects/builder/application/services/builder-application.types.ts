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
  BuilderEvaluationContractV3,
  BuilderExecutionResult,
  BuilderPlanContractV2,
  BuilderReportEntity,
  BuilderStageTokenUsage,
} from '../../domain/builder.types';

export interface EnqueueBuildRunResponse {
  buildRunId: string;
  status: BuildRunStatus;
  deliveryId: string;
}

export interface ExecuteBuildRunJobData {
  buildRunId: string;
  deliveryId: string;
  /**
   * Se incluye al encolar desde una petición, pero `processBuildRunJob` no lo
   * lee: la autorización ya se resolvió antes de encolar y el run guarda
   * `triggeredById`. Es opcional porque el reencolado de un run huérfano
   * (BuilderStaleRunRecoveryService) no dispone de la identidad original.
   */
  actor?: AuthenticatedUser;
  /**
   * Identificador de la petición HTTP que originó el run. Permite enlazar los
   * registros de la API con los del worker, que son procesos distintos y hasta
   * ahora no compartían ningún hilo común de diagnóstico. Ausente cuando el
   * encolado no nace de una petición (reencolado de un run huérfano).
   */
  correlationId?: string;
}

export interface BuilderPipelineResult {
  planAssessment: BuilderPlanContractV2;
  assessment: BuilderEvaluationContractV3;
  qualityFindings: BuilderCodeQualityContractV2;
  report: BuilderReportEntity;
  execution: BuilderExecutionResult;
  /** Avisos acumulados durante la preparación del workspace y las etapas. */
  warnings: string[];
  /** Consumo por llamada al LLM, con el proveedor y modelo que la sirvieron. */
  llmUsages: BuilderStageTokenUsage[];
}

export interface PaginatedBuildRunsResponse {
  data: BuildRun[];
  meta: PaginationMeta;
}
