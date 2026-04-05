/**
 * @fileoverview DTOs de salida para ejecuciones del builder.
 *
 * Contexto:
 * - Estandariza payloads de cola, detalle e historial de BuildRun.
 * - Sirve de contrato para Swagger y clientes de polling.
 *
 * @module BuildRunResponseDto
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BuildRun,
  BuildRunStatus,
} from '../../domain/entities/build-run.entity';

export class EnqueueBuildRunResponseDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Identificador del run creado en cola.',
  })
  buildRunId!: string;

  @ApiProperty({
    enum: BuildRunStatus,
    example: BuildRunStatus.QUEUED,
    description: 'Estado inicial del run.',
  })
  status!: BuildRunStatus;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440111',
    description: 'Identificador de la entrega asociada.',
  })
  deliveryId!: string;
}

export class BuildRunResponseDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id!: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440111',
  })
  deliveryId!: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440222',
  })
  triggeredById!: string;

  @ApiProperty({
    enum: BuildRunStatus,
    example: BuildRunStatus.BUILDING,
  })
  status!: BuildRunStatus;

  @ApiPropertyOptional({
    description: 'Resultado de detección de stack.',
    type: Object,
  })
  stackResult?: unknown;

  @ApiPropertyOptional({
    description: 'Dockerfile generado por el builder.',
  })
  dockerfileContent?: string | null;

  @ApiPropertyOptional({
    description: 'Resumen de logs y metadatos de build.',
    type: Object,
  })
  buildLogs?: unknown;

  @ApiPropertyOptional({
    description: 'Resultado de análisis de calidad.',
    type: Object,
  })
  qualityResult?: unknown;

  @ApiPropertyOptional({
    description: 'Tiempos de cada etapa del pipeline.',
    type: Object,
  })
  timingsMs?: unknown;

  @ApiPropertyOptional({
    description: 'Caracterización determinista del proyecto.',
    type: Object,
  })
  projectCharacterization?: unknown;

  @ApiPropertyOptional({
    description: 'Estrategia resultante de build/ejecución.',
    type: Object,
  })
  strategyResult?: unknown;

  @ApiPropertyOptional({
    description: 'Hallazgos estáticos detectados.',
    type: Object,
  })
  staticFindings?: unknown;

  @ApiPropertyOptional({
    description: 'Resultado por etapa (PASS/FAIL/SKIP).',
    type: Object,
  })
  stageResults?: unknown;

  @ApiPropertyOptional({
    description: 'Resultado de validación.',
    type: Object,
  })
  validationResult?: unknown;

  @ApiPropertyOptional({
    description: 'Artefactos de evidencia asociados al run.',
    type: Object,
  })
  evidenceArtifacts?: unknown;

  @ApiPropertyOptional({
    description: 'Informe para docencia en formato estructurado.',
    type: Object,
  })
  teacherReport?: unknown;

  @ApiPropertyOptional({
    description: 'Contexto de ejecución para reproducibilidad operativa.',
    type: Object,
  })
  executionContext?: unknown;

  @ApiPropertyOptional({
    description: 'Causa exacta de fallo (si aplica).',
  })
  failureReason?: string | null;

  @ApiProperty({
    type: [String],
    description: 'Avisos del pipeline.',
  })
  warnings!: string[];

  @ApiPropertyOptional({
    description: 'Tag de imagen Docker generada.',
  })
  imageTag?: string | null;

  @ApiPropertyOptional({
    description: 'Fecha de expiración de imagen Docker (TTL).',
    format: 'date-time',
  })
  imageExpiresAt?: string | null;

  @ApiPropertyOptional({
    description: 'Inicio de ejecución real.',
    format: 'date-time',
  })
  startedAt?: string | null;

  @ApiPropertyOptional({
    description: 'Fin de ejecución real.',
    format: 'date-time',
  })
  finishedAt?: string | null;

  @ApiProperty({
    description: 'Fecha de creación del run.',
    format: 'date-time',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Fecha de última actualización.',
    format: 'date-time',
  })
  updatedAt!: string;
}

export class PaginatedBuildRunsResponseDto {
  @ApiProperty({
    type: [BuildRunResponseDto],
  })
  data!: BuildRunResponseDto[];

  @ApiProperty({
    type: Object,
  })
  meta!: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export class CancelBuildRunResponseDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  buildRunId!: string;

  @ApiProperty({
    enum: BuildRunStatus,
    example: BuildRunStatus.CANCELLED,
  })
  status!: BuildRunStatus;
}

export class EvidenceArtifactDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id!: string;

  @ApiProperty({
    example: 'BUILD_LOG',
  })
  type!: string;

  @ApiProperty({
    example: 'application/json',
  })
  contentType!: string;

  @ApiProperty({
    example: 1024,
  })
  sizeBytes!: number;

  @ApiProperty({
    format: 'date-time',
  })
  createdAt!: string;
}

export class EvidenceDownloadUrlDto {
  @ApiProperty({
    example: 'https://minio.local/signed/url',
  })
  downloadUrl!: string;

  @ApiProperty({
    format: 'date-time',
  })
  expiresAt!: string;
}

export class TeacherReportResponseDto {
  @ApiProperty({
    enum: ['json', 'text'],
    example: 'json',
  })
  format!: 'json' | 'text';

  @ApiProperty({
    type: Object,
  })
  report!: unknown;
}

export function toBuildRunResponseDto(run: BuildRun): BuildRunResponseDto {
  return {
    id: run.id,
    deliveryId: run.deliveryId,
    triggeredById: run.triggeredById,
    status: run.status,
    stackResult: run.stackResult,
    dockerfileContent: run.dockerfileContent,
    buildLogs: run.buildLogs,
    qualityResult: run.qualityResult,
    timingsMs: run.timingsMs,
    projectCharacterization: run.projectCharacterization,
    strategyResult: run.strategyResult,
    staticFindings: run.staticFindings,
    stageResults: run.stageResults,
    validationResult: run.validationResult,
    evidenceArtifacts: run.evidenceArtifacts,
    teacherReport: run.teacherReport,
    executionContext: run.executionContext,
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
