import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { DeliveryStatus } from '../deliveries/entities/delivery.entity';

const BUILDER_OUTCOMES = ['PASS', 'FAIL', 'PARTIAL', 'UNKNOWN'] as const;

export type BuilderOutcome = (typeof BUILDER_OUTCOMES)[number];

export class ProjectProgressQueryDto {
  @ApiPropertyOptional({
    enum: DeliveryStatus,
    description: 'Filtra por último estado de entrega del alumno.',
  })
  @IsEnum(DeliveryStatus, {
    message: 'deliveryStatus debe ser un estado de entrega válido.',
  })
  @IsOptional()
  deliveryStatus?: DeliveryStatus;

  @ApiPropertyOptional({
    enum: BUILDER_OUTCOMES,
    description: 'Filtra por resultado global del último run del builder.',
  })
  @IsEnum(BUILDER_OUTCOMES, {
    message: 'builderOutcome debe ser un resultado de builder válido.',
  })
  @IsOptional()
  builderOutcome?: BuilderOutcome;

  @ApiPropertyOptional({
    example: 'true',
    description: 'Si vale true, exporta solo entregas marcadas como tardías.',
  })
  @IsString()
  @IsOptional()
  lateOnly?: string;

  @ApiPropertyOptional({
    description:
      'Filtra seguimiento o gradebook por un grupo docente concreto.',
    example: '550e8400-e29b-41d4-a716-446655440333',
  })
  @IsUUID('4', { message: 'groupId debe ser un UUID válido.' })
  @IsOptional()
  groupId?: string;
}
