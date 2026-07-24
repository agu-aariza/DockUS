/**
 * @fileoverview Señal de qué proceso está corriendo, expresada como módulo (ARQ-006).
 *
 * Contexto:
 * - Sustituye a `process.env.DOCKUS_ROLE`: la topología de dos procesos
 *   (API HTTP / worker BullMQ) era la decisión arquitectónica central del
 *   sistema, pero se resolvía en tiempo de ejecución con un global implícito
 *   en vez de en el sistema de módulos. `ApiModule` y `WorkerModule` declaran
 *   ahora su rol al componerse (`ProcessRoleModule.forRoot('api'|'worker')`),
 *   y cualquier provider en el árbol de imports puede inyectar `PROCESS_ROLE`
 *   sin cadenas de re-exports gracias a `@Global()`.
 *
 * @module ProcessRoleModule
 */

import { DynamicModule, Global, Module } from '@nestjs/common';

export const PROCESS_ROLE = 'PROCESS_ROLE';

export type ProcessRole = 'api' | 'worker';

@Global()
@Module({})
export class ProcessRoleModule {
  static forRoot(role: ProcessRole): DynamicModule {
    return {
      module: ProcessRoleModule,
      providers: [{ provide: PROCESS_ROLE, useValue: role }],
      exports: [PROCESS_ROLE],
    };
  }
}
