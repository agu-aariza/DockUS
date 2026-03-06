/**
 * @fileoverview App Service - Core Healthcheck Logic.
 * 
 * ============================================================================
 * METRICAS DE SALUD Y LIVENESS PROBE
 * ============================================================================
 * 
 * Proveemos la Lógica de Negocio Root. En esta fase temprana del ciclo de vida,
 * lo utilizamos primariamente como un endpoint de Liveness / Readiness para
 * orquestadores como Kubernetes o Docker Swarm.
 * 
 * Responsabilidades:
 * - Informar el estado base de la API (200 OK) sin tocar dependencias profundas.
 * 
 * @module AppService
 */

import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  /**
   * Endpoint Dummy (Health Check Base).
   * 
   * @returns Mensaje de confirmación de operatividad (Ping/Pong Base).
   */
  getHello(): string {
    return 'Hello World!';
  }
}
