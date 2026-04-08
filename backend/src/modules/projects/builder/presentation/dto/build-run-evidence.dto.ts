import { ApiProperty } from '@nestjs/swagger';

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

export class BuildRunReportResponseDto {
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
