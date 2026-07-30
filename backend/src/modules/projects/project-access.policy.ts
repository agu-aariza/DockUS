/**
 * @fileoverview Política de gestión de proyecto compartida.
 *
 * Contexto:
 * - La regla "quién puede administrar un proyecto" (ADMIN, o TEACHER asignado a
 *   él) es idéntica para el proyecto en sí y para su suite docente. Vivía
 *   duplicada en `ProjectAccessService` y `StorageAccessService`; aquí queda
 *   como función pura reutilizable, sin acoplar ambos servicios entre sí.
 * - Hasta la Fase 2 P2-2 (`ARQ-007`) este
 *   fichero también declaraba `isTeacherAssignedToProject(Repository<Project>, ...)`,
 *   la consulta más reutilizada de `projects/` (7 sitios). Ahora vive como
 *   método del puerto (`IProjectRepository.isTeacherAssignedToProject`) y los
 *   antiguos llamadores invocan `projectRepository.isTeacherAssignedToProject(...)`
 *   directo — mantener aquí un envoltorio de una sola línea sobre el puerto no
 *   aportaba nada.
 *
 * @module ProjectAccessPolicy
 */

import { ForbiddenException } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../users/entities/user.entity';
import type { Project } from './entities/project.entity';
import type { IProjectRepository } from './domain/repositories/project.repository.interface';

/**
 * Autoriza a `actor` a administrar `project`. Permite a los administradores y a
 * los docentes asignados al proyecto; en cualquier otro caso lanza
 * `ForbiddenException` con el mensaje indicado por el llamante.
 */
export async function assertTeacherCanManageProject(
  projectRepository: IProjectRepository,
  project: Project,
  actor: AuthenticatedUser,
  forbiddenMessage: string,
): Promise<void> {
  if (actor.role === UserRole.ADMIN) {
    return;
  }

  if (
    actor.role === UserRole.TEACHER &&
    (await projectRepository.isTeacherAssignedToProject(
      project.id,
      actor.userId,
    ))
  ) {
    return;
  }

  throw new ForbiddenException(forbiddenMessage);
}
