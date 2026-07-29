/**
 * @fileoverview Módulo de proyectos académicos y entregas (project-access.service).
 *
 * @module project-access.service
 */

import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../users/entities/user.entity';
import { Project, ProjectStatus } from './entities/project.entity';
import { assertTeacherCanManageProject } from './project-access.policy';
import type { IProjectRepository } from './domain/repositories/project.repository.interface';
import { PROJECT_REPOSITORY } from './domain/repositories/project.repository.interface';
import type { IProjectAssignmentRepository } from './domain/repositories/project-assignment.repository.interface';
import { PROJECT_ASSIGNMENT_REPOSITORY } from './domain/repositories/project-assignment.repository.interface';
import { applyProjectActorScope } from './infrastructure/database/project-actor-scope.util';

@Injectable()
export class ProjectAccessService {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projectsRepository: IProjectRepository,
    @Inject(PROJECT_ASSIGNMENT_REPOSITORY)
    private readonly assignmentsRepository: IProjectAssignmentRepository,
  ) {}

  async findProjectOrThrow(id: string): Promise<Project> {
    const project = await this.projectsRepository.findById(id);
    if (!project) {
      throw new NotFoundException('Proyecto no encontrado.');
    }
    return project;
  }

  async assertCanAccessProject(
    projectId: string,
    actor: AuthenticatedUser,
  ): Promise<Project> {
    const project = await this.findProjectOrThrow(projectId);

    if (actor.role === UserRole.ADMIN) {
      return project;
    }

    if (actor.role === UserRole.TEACHER) {
      const isAssigned =
        await this.projectsRepository.isTeacherAssignedToProject(
          projectId,
          actor.userId,
        );

      if (!isAssigned) {
        throw new ForbiddenException(
          'No tiene permisos sobre el proyecto solicitado.',
        );
      }
      return project;
    }

    const assignment =
      await this.assignmentsRepository.findActiveByProjectAndStudent(
        projectId,
        actor.userId,
      );
    if (!assignment) {
      throw new ForbiddenException(
        'No tiene una asignación activa sobre el proyecto solicitado.',
      );
    }

    if (project.status === ProjectStatus.DRAFT) {
      throw new ForbiddenException(
        'El proyecto todavía está en fase de borrador.',
      );
    }

    return project;
  }

  async findOwnedProjectOrThrow(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<Project> {
    const project = await this.findProjectOrThrow(id);
    await this.assertCanManageProject(project, actor);
    return project;
  }

  applyActorScope(
    queryBuilder: ReturnType<Repository<Project>['createQueryBuilder']>,
    actor: AuthenticatedUser,
  ): void {
    // ARQ-007: la lógica vive en infrastructure/database/ para que
    // ProjectRepository (el nuevo puerto) pueda reutilizarla sin que
    // infrastructure dependa de este servicio de aplicación. Este método
    // sigue existiendo tal cual para storage-query/deliveries-query/
    // storage-access, que no pasan por el puerto.
    applyProjectActorScope(queryBuilder, actor);
  }

  assertCanInspectOperationalIssues(actor: AuthenticatedUser): void {
    if (actor.role === UserRole.ADMIN || actor.role === UserRole.TEACHER) {
      return;
    }

    throw new ForbiddenException(
      'No tiene permisos para consultar incidencias operativas.',
    );
  }

  async assertCanManageProject(
    project: Project,
    actor: AuthenticatedUser,
  ): Promise<void> {
    await assertTeacherCanManageProject(
      this.projectsRepository,
      project,
      actor,
      'No tiene permisos para modificar el proyecto.',
    );
  }
}
