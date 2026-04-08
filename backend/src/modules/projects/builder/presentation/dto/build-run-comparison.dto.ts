import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class BuildRunComparisonRequestDto {
  @ApiProperty()
  @IsUUID()
  baseRunId!: string;

  @ApiProperty()
  @IsUUID()
  candidateRunId!: string;
}

export class BuildRunComparisonResponseDto {
  @ApiProperty({
    enum: ['IMPROVED', 'REGRESSED', 'UNCHANGED', 'MIXED'],
  })
  overallVerdict!: string;

  @ApiProperty({
    type: Object,
  })
  comparison!: unknown;
}

export class ReproducibilityResultDto {
  @ApiProperty({
    enum: ['MATCH', 'DRIFT', 'BLOCKED', 'INCONCLUSIVE'],
  })
  overallStatus!: string;

  @ApiProperty()
  summary!: string;

  @ApiProperty({
    type: [Object],
  })
  checks!: unknown[];
}
