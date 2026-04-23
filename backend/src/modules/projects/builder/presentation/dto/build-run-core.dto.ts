import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BuildRunStatus } from '../../domain/entities/build-run.entity';

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
    enum: ['STANDARD'],
    example: 'STANDARD',
  })
  runKind!: string;

  @ApiProperty({
    enum: BuildRunStatus,
    example: BuildRunStatus.BUILDING,
  })
  status!: BuildRunStatus;

  @ApiPropertyOptional({
    enum: [
      'ANALYSIS',
      'BUILD',
      'DEPLOY',
      'PROBES',
      'STABILITY',
      'TESTS',
      'CLEANUP',
    ],
    example: 'BUILD',
  })
  activeStage?: string | null;

  @ApiPropertyOptional({
    example: 42,
  })
  latestEventSequence?: number | null;

  @ApiProperty({
    example: false,
  })
  isTerminal!: boolean;

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
    description: 'Tiempos de cada etapa del pipeline.',
    type: Object,
  })
  timingsMs?: unknown;

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
    description:
      'Contrato canónico LLM-only del builder con taxonomía T/C/E y receta observada.',
    type: Object,
  })
  llmAssessment?: unknown;

  @ApiPropertyOptional({
    description: 'Artefactos de evidencia asociados al run.',
    type: Object,
  })
  evidenceArtifacts?: unknown;

  @ApiPropertyOptional({
    description:
      'Informe canónico derivado de la evaluación LLM final en taxonomía T/C/E.',
    type: Object,
  })
  report?: unknown;

  @ApiPropertyOptional({
    description: 'Contexto de ejecución capturado durante el run.',
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
