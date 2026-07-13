/**
 * @fileoverview Política de gestión de proyecto compartida.
 *
 * Contexto:
 * - La regla "quién puede administrar un proyecto" (ADMIN, o TEACHER asignado a
 *   él) es idéntica para el proyecto en sí y para su suite docente. Vivía
 *   duplicada en `ProjectAccessService` y `StorageAccessService`; aquí queda
 *   como función pura reutilizable, sin acoplar ambos servicios entre sí.
 *
 * @module ProjectAccessPolicy
 */

import { ForbiddenException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../users/entities/user.entity';
import type { Project } from './entities/project.entity';

/**
 * Comprueba si un docente está asignado a un proyecto. Es la consulta que varios
 * servicios de acceso repetían textualmente; centralizarla evita que diverjan.
 */
export function isTeacherAssignedToProject(
  projectsRepository: Repository<Project>,
  projectId: string,
  teacherId: string,
): Promise<boolean> {
  return projectsRepository
    .createQueryBuilder('project')
    .innerJoin('project.teachers', 'teacher')
    .where('project.id = :projectId', { projectId })
    .andWhere('teacher.id = :teacherId', { teacherId })
    .getExists();
}

/**
 * Autoriza a `actor` a administrar `project`. Permite a los administradores y a
 * los docentes asignados al proyecto; en cualquier otro caso lanza
 * `ForbiddenException` con el mensaje indicado por el llamante.
 */
export async function assertTeacherCanManageProject(
  projectsRepository: Repository<Project>,
  project: Project,
  actor: AuthenticatedUser,
  forbiddenMessage: string,
): Promise<void> {
  if (actor.role === UserRole.ADMIN) {
    return;
  }

  if (
    actor.role === UserRole.TEACHER &&
    (await isTeacherAssignedToProject(
      projectsRepository,
      project.id,
      actor.userId,
    ))
  ) {
    return;
  }

  throw new ForbiddenException(forbiddenMessage);
}
