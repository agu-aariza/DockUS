/**
 * @fileoverview Controlador de salud técnica del backend.
 *
 * Contexto:
 * - Expone endpoints de liveness y readiness para orquestadores.
 * - Devuelve estado consolidado de dependencias críticas.
 *
 * @module HealthController
 */

import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service';

@ApiTags('System Health')
@Controller('health')
@UseGuards(ThrottlerGuard)
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * Healthcheck de liveness para validar que el proceso responde.
   */
  @ApiOperation({
    summary: 'Liveness de la API',
    description: 'Confirma que el proceso HTTP está vivo y responde.',
  })
  @ApiResponse({
    status: 200,
    description: 'Proceso activo y respondiendo solicitudes.',
  })
  @Get('live')
  getLiveness() {
    return this.healthService.getLiveness();
  }

  /**
   * Healthcheck de readiness para validar dependencias externas.
   */
  @ApiOperation({
    summary: 'Readiness de infraestructura',
    description:
      'Comprueba conectividad real con PostgreSQL, Redis, Docker y Amazon Bedrock antes de recibir tráfico.',
  })
  @ApiResponse({
    status: 200,
    description: 'Dependencias críticas listas.',
  })
  @ApiResponse({
    status: 503,
    description: 'Una o más dependencias críticas no están disponibles.',
  })
  // El override anterior nombraba un cubo `default` que no existe entre los
  // configurados (`global`, `burst`, `auth-identity`), de modo que no surtía
  // efecto alguno. Se nombra el cubo real. El límite es holgado a propósito:
  // esta sonda la consultan el orquestador y el balanceador de forma continua,
  // y estrangularla provocaría el retirado de instancias sanas.
  @Throttle({ global: { limit: 120, ttl: 60_000 } })
  @Get('readiness')
  async getReadiness() {
    const readiness = await this.healthService.getReadiness();

    if (readiness.status === 'error') {
      throw new HttpException(readiness, HttpStatus.SERVICE_UNAVAILABLE);
    }

    return readiness;
  }
}
