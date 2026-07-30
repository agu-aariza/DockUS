/**
 * @fileoverview Restringe una query de `BuildRun` (agregada por entrega) a lo
 * visible por el actor.
 *
 * Contexto:
 * - Extraído de `BuilderRunQueriesService.listLatestRunsByDeliveryIds`
 *   (plan_accion.md P2-4), mismo motivo que `delivery-actor-scope.util.ts`/
 *   `project-actor-scope.util.ts`/`project-assignment-actor-scope.util.ts`:
 *   `BuildRunRepository.findLatestByDeliveryIdsForActor` necesita la misma
 *   lógica de scoping sin exponer `SelectQueryBuilder` en el puerto.
 * - Asume que la query ya hizo `innerJoin('run.delivery', 'delivery')` —
 *   STUDENT filtra sobre esa relación directa; TEACHER necesita además
 *   `delivery.assignment`/`assignment.project`/`project.teachers`, que este
 *   util añade solo en su rama porque ADMIN/STUDENT no los necesitan.
 * - Cero cambio de comportamiento: mismo cuerpo de función, reubicado.
 *
 * @module BuildRunActorScopeUtil
 */

import { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../../../../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../../../../users/entities/user.entity';
import { BuildRun } from '../../domain/entities/build-run.entity';

export function applyBuildRunActorScope(
  queryBuilder: ReturnType<Repository<BuildRun>['createQueryBuilder']>,
  actor: AuthenticatedUser,
): void {
  if (actor.role === UserRole.STUDENT) {
    queryBuilder.andWhere('delivery.authorId = :userId', {
      userId: actor.userId,
    });
    return;
  }

  if (actor.role === UserRole.TEACHER) {
    queryBuilder
      .innerJoin('delivery.assignment', 'assignment')
      .innerJoin('assignment.project', 'project')
      .innerJoin('project.teachers', 'scopedTeacher')
      .andWhere('scopedTeacher.id = :userId', { userId: actor.userId });
    return;
  }

  // ADMIN: sin filtro adicional, ve el batch completo.
}
