/**
 * @fileoverview Motor Builder de evaluación asíncrona (build-run-events.dto).
 *
 * @module build-run-events.dto
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BuildRunStatus } from '../../domain/entities/build-run.entity';

export class BuildRunEventDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  buildRunId!: string;

  @ApiProperty()
  sequence!: number;

  @ApiProperty({
    enum: [
      'RUN_ENQUEUED',
      'RUN_STARTED',
      'RUN_STATUS_CHANGED',
      'STAGE_STARTED',
      'STAGE_FINISHED',
      'LOG_CHUNK',
      'WARNING_ADDED',
      'ARTIFACT_ADDED',
      'REPORT_READY',
      'REPRODUCIBILITY_READY',
      'RUN_COMPLETED',
      'RUN_FAILED',
      'RUN_CANCELLED',
    ],
  })
  eventType!: string;

  @ApiPropertyOptional({
    enum: BuildRunStatus,
  })
  runStatus?: string | null;

  @ApiPropertyOptional()
  stage?: string | null;

  @ApiProperty()
  message!: string;

  @ApiPropertyOptional({
    type: Object,
  })
  payload?: Record<string, unknown> | null;

  @ApiProperty({
    format: 'date-time',
  })
  createdAt!: string;
}

export class BuildRunEventsResponseDto {
  @ApiProperty({
    type: [BuildRunEventDto],
  })
  events!: BuildRunEventDto[];

  @ApiProperty({
    example: 42,
  })
  latestSequence!: number;

  @ApiProperty({
    example: false,
  })
  hasMore!: boolean;
}
