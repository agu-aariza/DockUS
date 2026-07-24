/**
 * @fileoverview Módulo raíz del servidor HTTP REST (API Entrypoint).
 *
 * @description
 * Define la composición de módulos necesaria para atender peticiones web REST.
 * Importa:
 * 1. `ProcessRoleModule.forRoot('api')` para señalar el rol del proceso.
 * 2. `CoreModule` con los dominios del negocio (Auth, Users, Academic, Projects).
 * 3. `HealthModule` para exponer las sondas de liveness y readiness (`/health/*`).
 *
 * @module ApiModule
 */

import { Module } from '@nestjs/common';
import { CoreModule } from './core.module';
import { HealthModule } from './modules/health/health.module';
import { ProcessRoleModule } from './process-role.module';

/**
 * Módulo raíz para el servidor HTTP API REST.
 */
@Module({
  imports: [ProcessRoleModule.forRoot('api'), CoreModule, HealthModule],
})
export class ApiModule {}
