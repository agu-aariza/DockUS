import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../users/entities/user.entity';
import { ProjectAssignment } from './assignments/entities/project-assignment.entity';
import { Project, ProjectStatus } from './entities/project.entity';

@Injectable()
export class ProjectAccessService {
  constructor(
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
    @InjectRepository(ProjectAssignment)
    private readonly assignmentsRepository: Repository<ProjectAssignment>,
  ) {}

  async findProjectOrThrow(id: string): Promise<Project> {
    const project = await this.projectsRepository.findOne({ where: { id } });
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
      if (project.creatorId !== actor.userId) {
        throw new ForbiddenException(
          'No tiene permisos sobre el proyecto solicitado.',
        );
      }
      return project;
    }

    const assignment = await this.assignmentsRepository.findOne({
      where: {
        projectId,
        studentId: actor.userId,
        revokedAt: IsNull(),
      },
    });
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
    this.assertCanManageProject(project, actor);
    return project;
  }

  applyActorScope(
    queryBuilder: ReturnType<Repository<Project>['createQueryBuilder']>,
    actor: AuthenticatedUser,
  ): void {
    if (actor.role === UserRole.ADMIN) {
      return;
    }

    if (actor.role === UserRole.TEACHER) {
      queryBuilder.andWhere('project.creatorId = :requestUserId', {
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

  assertCanInspectOperationalIssues(actor: AuthenticatedUser): void {
    if (actor.role === UserRole.ADMIN || actor.role === UserRole.TEACHER) {
      return;
    }

    throw new ForbiddenException(
      'No tiene permisos para consultar incidencias operativas.',
    );
  }

  assertCanManageProject(project: Project, actor: AuthenticatedUser): void {
    if (actor.role === UserRole.ADMIN) {
      return;
    }

    if (actor.role === UserRole.TEACHER && project.creatorId === actor.userId) {
      return;
    }

    throw new ForbiddenException(
      'No tiene permisos para modificar el proyecto.',
    );
  }
}
