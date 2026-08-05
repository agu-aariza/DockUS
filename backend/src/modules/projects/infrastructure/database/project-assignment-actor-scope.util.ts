/**
 * @fileoverview Restringe una query de `ProjectAssignment` (vista desde un
 * alumno concreto) a lo visible por el actor.
 *
 * Contexto:
 * - El helper se comparte con las consultas de entregas y proyectos:
 *   `ProjectAssignmentRepository.findVisibleForStudent`
 * necesita la misma lógica de scoping sin exponer `SelectQueryBuilder` en
 * el puerto.
 * - A diferencia de los otros dos utils de scope, aquí no hay rama STUDENT:
 * `studentId` ya viene fijado como parámetro — el actor solo puede ser
 * ADMIN (sin restricción) o TEACHER (restringido a sus proyectos).
 * - Cero cambio de comportamiento: mismo cuerpo de función, reubicado.
 *
 * @module ProjectAssignmentActorScopeUtil
 */

import { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../../../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../../../users/entities/user.entity';
import { ProjectAssignment } from '../../assignments/entities/project-assignment.entity';

export function applyProjectAssignmentActorScope(
  queryBuilder: ReturnType<Repository<ProjectAssignment>['createQueryBuilder']>,
  actor: AuthenticatedUser,
): void {
  if (actor.role !== UserRole.TEACHER) {
    return;
  }

  // `teacher` ya está en el leftJoin, pero filtrar por él lo convertiría en
  // un inner join implícito y recortaría el equipo docente devuelto: se usa
  // una subconsulta para acotar sin mutilar la relación.
  queryBuilder.andWhere(
    `EXISTS (
      SELECT 1 FROM project_teachers pt
      WHERE pt."projectId" = project.id AND pt."teacherId" = :actorId
    )`,
    { actorId: actor.userId },
  );
}
