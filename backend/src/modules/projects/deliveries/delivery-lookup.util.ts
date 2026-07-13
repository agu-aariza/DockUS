/**
 * @fileoverview Lookup de entrega con sus relaciones de asignación.
 *
 * Contexto:
 * - Varios servicios de acceso cargaban la entrega con las mismas relaciones
 *   (`assignment.project`, `assignment.student`) y lanzaban `NotFoundException`
 *   si no existía, variando solo el mensaje. Se centraliza aquí como función
 *   pura parametrizada por el mensaje.
 *
 * @module delivery-lookup.util
 */

import { NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { Delivery } from './entities/delivery.entity';

export async function findDeliveryWithAssignmentOrThrow(
  deliveriesRepository: Repository<Delivery>,
  deliveryId: string,
  notFoundMessage: string,
): Promise<Delivery> {
  const delivery = await deliveriesRepository.findOne({
    where: { id: deliveryId },
    relations: {
      assignment: {
        project: true,
        student: true,
      },
    },
  });

  if (!delivery) {
    throw new NotFoundException(notFoundMessage);
  }

  return delivery;
}
