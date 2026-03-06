/**
 * @fileoverview App Controller - Gateway Root y Healthchecks.
 * 
 * ============================================================================
 * ENDPOINTS DE ESTADO DEL SISTEMA
 * ============================================================================
 * 
 * Este controlador expone los puntos de entrada básicos para la verificación
 * de operatividad del microservicio (Liveness/Readiness).
 * 
 * @module AppController
 * @requires @nestjs/common
 * @requires @nestjs/swagger
 */

import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('System Health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) { }

  /**
   * Healthcheck primario de Liveness.
   * 
   * Nota de SRE (Site Reliability Engineering):
   * Este endpoint es crítico para las sondas de preparación de los balanceadores.
   * Un retorno exitoso confirma que el thread principal del Kernel está despachando eventos.
   */
  @ApiOperation({
    summary: 'Verificar salud del sistema',
    description: 'Endpoint ligero para sondas de orquestación (Kubernetes/Docker/AWS ELB).',
  })
  @ApiResponse({ status: 200, description: 'Servicio operativo y listo para recibir tráfico.' })
  @ApiResponse({ status: 500, description: 'Fallo de Infraestructura: El Kernel no responde adecuadamente.' })
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
