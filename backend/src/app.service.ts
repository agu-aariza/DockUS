/**
 * @fileoverview App Service - Core Healthcheck Logic.
 *
 * ============================================================================
 * METRICAS DE SALUD Y LIVENESS PROBE
 * ============================================================================
 *
 * Proveemos la Lógica de Negocio Root. En esta fase temprana del ciclo de vida,
 * lo utilizamos primariamente como un endpoint de Liveness / Readiness para
 * el orquestador Kubernetes.
 *
 * Responsabilidades:
 * - Informar el estado base de la API (200 OK).
 *
 * @module AppService
 */

import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  /**
   * Endpoint Dummy (Health Check Base).
   *
   * @returns Mensaje de confirmación de operatividad.
   */
  getHello(): string {
    return 'Hello World!';
  }
}
