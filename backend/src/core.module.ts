/**
 * @fileoverview Grafo de módulos de dominio e infraestructura compartido por
 * ambos procesos (ARQ-006).
 *
 * Contexto:
 * - Antes era `AppModule`, y el worker lo importaba entero (incluido
 *   `HealthModule`, que ninguno de sus jobs necesita) a través de
 *   `AppWorkerModule`. Extraerlo permite que `ApiModule` y `WorkerModule`
 *   compongan explícitamente qué arranca cada entrypoint, en vez de compartir
 *   un único módulo raíz y diferenciar comportamiento con un env-flag.
 *
 * @module CoreModule
 */

import { Module } from '@nestjs/common';
import { AcademicModule } from './modules/academic/academic.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { UsersModule } from './modules/users/users.module';
import { InfrastructureModule } from './shared/infrastructure/infrastructure.module';

@Module({
  imports: [
    InfrastructureModule,
    UsersModule,
    AuthModule,
    AcademicModule,
    ProjectsModule,
  ],
})
export class CoreModule {}
