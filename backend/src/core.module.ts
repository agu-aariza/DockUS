/**
 * @fileoverview Grafo de módulos de dominio e infraestructura compartido por ambos procesos.
 *
 * @description
 * Agrupa y orquesta todos los módulos de dominio de negocio de EduCodeAI:
 * 1. `InfrastructureModule` (Persistencia PostgreSQL, Redis, S3/MinIO, AI Router).
 * 2. `UsersModule` (Gestión de identidades y usuarios).
 * 3. `AuthModule` (Autenticación JWT y estrategias de acceso).
 * 4. `AcademicModule` (Grupos académicos y matrículas).
 * 5. `ProjectsModule` (Proyectos, entregas y submodulo Builder).
 *
 * Sirve como núcleo compartido tanto para `ApiModule` como para `WorkerModule`.
 *
 * @module CoreModule
 */

import { Module } from '@nestjs/common';
import { AcademicModule } from './modules/academic/academic.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { UsersModule } from './modules/users/users.module';
import { InfrastructureModule } from './shared/infrastructure/infrastructure.module';

/**
 * Módulo central de dominio e infraestructura compartida del sistema.
 */
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
