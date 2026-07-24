/**
 * @fileoverview Módulo hoja para `DeliveryStatusService` (ARQ-003).
 *
 * Contexto:
 * - `ProjectsModule` importa `BuilderModule`, nunca al revés: un `Delivery`
 *   escribible desde ambos lados sin crear un ciclo de módulos necesita vivir
 *   en un módulo hoja que los dos puedan importar de forma independiente.
 *
 * @module DeliveryStatusModule
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Delivery } from './entities/delivery.entity';
import { DeliveryStatusService } from './delivery-status.service';

@Module({
  imports: [TypeOrmModule.forFeature([Delivery])],
  providers: [DeliveryStatusService],
  exports: [DeliveryStatusService],
})
export class DeliveryStatusModule {}
