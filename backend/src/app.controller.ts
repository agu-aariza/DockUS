/**
 * @fileoverview Controlador HTTP para endpoints base de estado.
 *
 * Contexto:
 * - Expone rutas públicas de salud y disponibilidad.
 * - Delega la respuesta de negocio en AppService.
 *
 * @module AppController
 */

import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('System Health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * Healthcheck primario de Liveness.
   *
   * Este endpoint es crítico para las sondas de preparación de los balanceadores.
   * Un retorno exitoso confirma que el thread principal del Kernel está despachando eventos.
   */
  @ApiOperation({
    summary: 'Verificar salud del sistema',
    description: 'Endpoint ligero para sondas de orquestación.',
  })
  @ApiResponse({
    status: 200,
    description: 'Servicio operativo y listo para recibir tráfico.',
  })
  @ApiResponse({
    status: 500,
    description:
      'Fallo de Infraestructura: El Kernel no responde adecuadamente.',
  })
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
