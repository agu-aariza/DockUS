/**
 * @fileoverview Módulo raíz del proceso HTTP (ARQ-006).
 *
 * Contexto:
 * - `CoreModule` + lo que solo la API necesita: `HealthModule` (sondas de
 *   liveness/readiness) y la señal `PROCESS_ROLE = 'api'` que consumen los
 *   servicios que antes miraban `process.env.DOCKUS_ROLE` (el suscriptor SSE
 *   de `BuilderRunEventsService`, entre otros).
 *
 * @module ApiModule
 */

import { Module } from '@nestjs/common';
import { CoreModule } from './core.module';
import { HealthModule } from './modules/health/health.module';
import { ProcessRoleModule } from './process-role.module';

@Module({
  imports: [ProcessRoleModule.forRoot('api'), CoreModule, HealthModule],
})
export class ApiModule {}
