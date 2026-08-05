/**
 * @fileoverview Módulo hoja para `DeliveryStatusService` y el puerto de
 * persistencia de `Delivery`.
 *
 * Contexto:
 * - `ProjectsModule` importa `BuilderModule` y `StorageModule`, nunca al
 * revés: un `Delivery` escribible desde los tres sin crear un ciclo de
 * módulos necesita vivir en un módulo hoja que los tres puedan importar de
 * forma independiente. Exporta también `DELIVERY_REPOSITORY` por el mismo
 * motivo — es el precedente que `ProjectPersistenceModule` y
 * `ProjectAssignmentPersistenceModule` replican.
 *
 * @module DeliveryStatusModule
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Delivery } from './entities/delivery.entity';
import { DeliveryStatusService } from './delivery-status.service';
import { DeliveryRepository } from '../infrastructure/database/delivery.repository';
import { DELIVERY_REPOSITORY } from '../domain/repositories/delivery.repository.interface';

@Module({
  imports: [TypeOrmModule.forFeature([Delivery])],
  providers: [
    DeliveryStatusService,
    {
      provide: DELIVERY_REPOSITORY,
      useClass: DeliveryRepository,
    },
  ],
  exports: [DeliveryStatusService, DELIVERY_REPOSITORY],
})
export class DeliveryStatusModule {}
