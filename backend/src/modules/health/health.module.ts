/**
 * @fileoverview Módulo de healthchecks y estado operativo.
 *
 * Contexto:
 * - Encapsula endpoints de salud técnica del backend.
 * - Centraliza lógica de verificación de dependencias críticas.
 *
 * @module HealthModule
 */

import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../../shared/infrastructure/infrastructure.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [InfrastructureModule],
  controllers: [HealthController],
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthModule {}
