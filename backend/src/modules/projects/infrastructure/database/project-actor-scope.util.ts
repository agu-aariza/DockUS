/**
 * @fileoverview Restringe una query de `Project` a lo visible por el actor.
 *
 * Contexto:
 * - `ProjectRepository.findAllForActor`/`findByIdForActor` comparten esta
 * lógica de scoping para no exponer `SelectQueryBuilder` en el puerto.
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
