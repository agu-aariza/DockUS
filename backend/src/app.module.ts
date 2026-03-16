/**
 * @fileoverview Módulo raíz de la aplicación NestJS.
 *
 * Contexto:
 * - Ensambla módulos de infraestructura y de dominio en un único grafo.
 * - Mantiene el punto de composición principal del backend.
 *
 * @module AppModule
 */

import { Module } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { UsersModule } from './modules/users/users.module';
import { InfrastructureModule } from './shared/infrastructure/infrastructure.module';

@Module({
  imports: [InfrastructureModule, UsersModule, AuthModule, HealthModule],
})
export class AppModule {}
