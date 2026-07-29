/**
 * @fileoverview Restringe una query de `Delivery` a lo visible por el actor.
 *
 * Contexto:
 * - Extraído de `DeliveriesQueryService.applyActorScope` (plan_accion.md
 *   P2-1), mismo motivo que `project-actor-scope.util.ts` (ARQ-007):
 *   `DeliveryRepository.findAllForActor`/`findByIdForActor` necesitan la
 *   misma lógica de scoping sin exponer `SelectQueryBuilder` en el puerto.
 * - Cero cambio de comportamiento: mismo cuerpo de función, reubicado.
 *
 * @module DeliveryActorScopeUtil
 */

import { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../../../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../../../users/entities/user.entity';
import { Delivery } from '../../deliveries/entities/delivery.entity';

export function applyDeliveryActorScope(
  queryBuilder: ReturnType<Repository<Delivery>['createQueryBuilder']>,
  actor: AuthenticatedUser,
): void {
  if (actor.role === UserRole.ADMIN) {
    return;
  }

  if (actor.role === UserRole.TEACHER) {
    // Un co-docente asignado (no solo el creador original) debe poder ver
    // las entregas del proyecto: misma política que ProjectAccessService/
    // StorageAccessService/BuilderAccessService (ver isTeacherAssignedToProject).
    queryBuilder
      .innerJoin('project.teachers', 'scopedTeacher')
      .andWhere('scopedTeacher.id = :requestUserId', {
        requestUserId: actor.userId,
      });
    return;
  }

  queryBuilder.andWhere('delivery.authorId = :requestUserId', {
    requestUserId: actor.userId,
  });
}
