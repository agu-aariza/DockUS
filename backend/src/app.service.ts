/**
 * @fileoverview Servicio base para liveness de la API.
 *
 * Contexto:
 * - Provee una respuesta simple para verificar operatividad.
 * - Se usa por AppController en el endpoint raíz.
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
