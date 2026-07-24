/**
 * @fileoverview Escritura interna del estado de una entrega, sin control de
 * acceso (ARQ-003).
 *
 * Contexto:
 * - Único punto que muta `Delivery.status` desde fuera de `deliveries/`:
 *   antes, `BuilderRunCommandsService.processBuildRunJob` reimplementaba el
 *   mismo find+save a mano, un sub-contexto escribiendo directamente el
 *   estado de otro.
 * - Sin control de acceso a propósito: quien invoca esto (el ciclo de vida
 *   del run del builder, no una petición HTTP) ya decidió la transición; la
 *   autorización ocurrió más arriba, al lanzar o cancelar el run.
 *
 * @module DeliveryStatusService
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Delivery, DeliveryStatus } from './entities/delivery.entity';

@Injectable()
export class DeliveryStatusService {
  constructor(
    @InjectRepository(Delivery)
    private readonly deliveriesRepository: Repository<Delivery>,
  ) {}

  async updateStatusInternal(
    id: string,
    status: DeliveryStatus,
  ): Promise<void> {
    const delivery = await this.deliveriesRepository.findOne({
      where: { id },
    });
    if (!delivery) {
      throw new NotFoundException('Entrega no encontrada.');
    }

    delivery.status = status;
    await this.deliveriesRepository.save(delivery);
  }
}
