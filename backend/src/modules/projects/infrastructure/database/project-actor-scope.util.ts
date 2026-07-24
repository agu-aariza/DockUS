/**
 * @fileoverview Restringe una query de `Project` a lo visible por el actor.
 *
 * Contexto:
 * - Extraído de `ProjectAccessService.applyActorScope` (audit/04 ARQ-007):
 *   `ProjectRepository.findAllForActor`/`findByIdForActor` necesitan la misma
 *   lógica de scoping para dejar de exponer `SelectQueryBuilder` en el puerto,
 *   y duplicarla habría sido la alternativa a esto. `ProjectAccessService`
 *   sigue siendo el punto de entrada para sus otros tres llamadores
 *   (storage-query, deliveries-query, storage-access) — delega aquí, no al
 *   revés, para no invertir la dependencia infrastructure -> application.
 * - Cero cambio de comportamiento: es el mismo cuerpo de función, reubicado.
 *
 * @module ProjectActorScopeUtil
 */

import { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../../../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../../../users/entities/user.entity';
import { ProjectAssignment } from '../../assignments/entities/project-assignment.entity';
import { Project, ProjectStatus } from '../../entities/project.entity';

export function applyProjectActorScope(
  queryBuilder: ReturnType<Repository<Project>['createQueryBuilder']>,
  actor: AuthenticatedUser,
): void {
  if (actor.role === UserRole.ADMIN) {
    return;
  }

  if (actor.role === UserRole.TEACHER) {
    queryBuilder
      .innerJoin('project.teachers', 'scopedTeacher')
      .andWhere('scopedTeacher.id = :requestUserId', {
        requestUserId: actor.userId,
      });
    return;
  }

  queryBuilder
    .innerJoin(
      ProjectAssignment,
      'assignment',
      'assignment.projectId = project.id AND assignment.studentId = :requestUserId AND assignment.revokedAt IS NULL',
      {
        requestUserId: actor.userId,
      },
    )
    .andWhere('project.status != :draftStatus', {
      draftStatus: ProjectStatus.DRAFT,
    })
    .distinct(true);
}
