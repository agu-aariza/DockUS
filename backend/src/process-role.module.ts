/**
 * @fileoverview Proveedor dinámico global del rol del proceso en ejecución.
 *
 * @description
 * Modulo global dinámico que inyecta la constante token `PROCESS_ROLE` (`'api'` o `'worker'`)
 * en el contenedor de inyección de dependencias de NestJS.
 *
 * Esto permite a los servicios de infraestructura o dominio adaptar su comportamiento
 * (ej. la suscripción a eventos Redis SSE vs la ejecución de workers BullMQ) sin depender
 * de variables globales de entorno en tiempo de ejecución.
 *
 * @module ProcessRoleModule
 */

import { DynamicModule, Global, Module } from '@nestjs/common';

/** Token de inyección de dependencias para el rol del proceso. */
export const PROCESS_ROLE = 'PROCESS_ROLE';

/** Tipos de roles de proceso soportados en el sistema DockUS. */
export type ProcessRole = 'api' | 'worker';

/**
 * Módulo dinámico global que registra la señal del rol de proceso activo.
 */
@Global()
@Module({})
export class ProcessRoleModule {
  /**
   * Configura e instancia el token `PROCESS_ROLE` para el proceso en ejecución.
   *
   * @param role - El rol del proceso activo (`'api'` o `'worker'`).
   * @returns El módulo dinámico configurado globalmente.
   */
  static forRoot(role: ProcessRole): DynamicModule {
    return {
      module: ProcessRoleModule,
      providers: [{ provide: PROCESS_ROLE, useValue: role }],
      exports: [PROCESS_ROLE],
    };
  }
}
