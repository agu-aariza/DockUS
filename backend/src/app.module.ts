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
import { AuthModule } from './auth/auth.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [InfrastructureModule, UsersModule, AuthModule],
  controllers: [AppController], // Gateway Root (Healthchecks)
  providers: [AppService], // Providers de infraestructura global
})
export class AppModule {}
