/**
 * @fileoverview Módulo de entregas de proyectos.
 *
 * @module DeliveriesModule
 */

import { Module } from '@nestjs/common';
import { ProjectAssignmentPersistenceModule } from '../assignments/project-assignment-persistence.module';
import { ProjectPersistenceModule } from '../project-persistence.module';
import { StorageModule } from '../storage/storage.module';
import { DeliveryStatusModule } from './delivery-status.module';
import { DeliveriesCommandService } from './deliveries-command.service';
import { DeliveriesQueryService } from './deliveries-query.service';
import { DeliveriesController } from '../presentation/deliveries.controller';

@Module({
  imports: [
    DeliveryStatusModule,
    ProjectPersistenceModule,
    ProjectAssignmentPersistenceModule,
    StorageModule,
  ],
  controllers: [DeliveriesController],
  providers: [DeliveriesQueryService, DeliveriesCommandService],
  exports: [DeliveriesQueryService, DeliveriesCommandService],
})
export class DeliveriesModule {}
