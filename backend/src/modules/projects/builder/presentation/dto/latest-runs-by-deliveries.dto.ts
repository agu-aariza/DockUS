/**
 * @fileoverview DTOs para el batch de "último run por entrega".
 *
 * Contexto:
 * - Resuelve el último run de todas las entregas con una consulta batch y
 *   devuelve las entregas sin ejecución como `null`, evitando un fan-out N+1.
 *
 * @module LatestRunsByDeliveriesDto
 */

import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsUUID } from 'class-validator';
import { BuildRunResponseDto } from './build-run-core.dto';

export const MAX_LATEST_RUNS_DELIVERY_IDS = 100;

export class LatestRunsByDeliveriesQueryDto {
  @ApiProperty({
    description: `IDs de entrega separados por coma (maximo ${MAX_LATEST_RUNS_DELIVERY_IDS}).`,
    example:
      '550e8400-e29b-41d4-a716-446655440000,550e8400-e29b-41d4-a716-446655440001',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? Array.from(
          new Set(
            value
              .split(',')
              .map((id) => id.trim())
              .filter(Boolean),
          ),
        )
      : value,
  )
  @ArrayMinSize(1, {
    message: 'deliveryIds debe incluir al menos un identificador.',
  })
  @ArrayMaxSize(MAX_LATEST_RUNS_DELIVERY_IDS, {
    message: `deliveryIds admite como maximo ${MAX_LATEST_RUNS_DELIVERY_IDS} identificadores por peticion.`,
  })
  @IsUUID('4', {
    each: true,
    message: 'Cada deliveryId debe ser un UUID valido.',
  })
  deliveryIds!: string[];
}

export class LatestRunsByDeliveriesResponseDto {
  @ApiProperty({
    description:
      'Mapa deliveryId -> ultimo BuildRun (null si la entrega no tiene ejecuciones, o si el actor no tiene acceso a ella).',
    type: Object,
  })
  data!: Record<string, BuildRunResponseDto | null>;
}
