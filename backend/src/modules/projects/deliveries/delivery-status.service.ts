/**
 * @fileoverview Escritura interna del estado de una entrega, sin control de
 * acceso.
 *
 * Contexto:
 * - Único punto que muta `Delivery.status` desde fuera de `deliveries/`:
 * antes, `BuilderRunCommandsService.processBuildRunJob` reimplementaba el
 * mismo find+save a mano, un sub-contexto escribiendo directamente el
 * estado de otro.
 * - Sin control de acceso a propósito: quien invoca esto (el ciclo de vida
 * del run del builder, no una petición HTTP) ya decidió la transición; la
 * autorización ocurrió más arriba, al lanzar o cancelar el run.
 *
 * @module DeliveryStatusService
 */

import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DeliveryStatus } from './entities/delivery.entity';
import type { IDeliveryRepository } from '../domain/repositories/delivery.repository.interface';
import { DELIVERY_REPOSITORY } from '../domain/repositories/delivery.repository.interface';

@Injectable()
export class DeliveryStatusService {
  constructor(
    @Inject(DELIVERY_REPOSITORY)
    private readonly deliveriesRepository: IDeliveryRepository,
  ) {}

  async updateStatusInternal(
    id: string,
    status: DeliveryStatus,
  ): Promise<void> {
    const delivery = await this.deliveriesRepository.findById(id);
    if (!delivery) {
      throw new NotFoundException('Entrega no encontrada.');
    }

    delivery.status = status;
    await this.deliveriesRepository.save(delivery);
  }
}
