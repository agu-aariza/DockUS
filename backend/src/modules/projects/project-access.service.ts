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
import { assertTeacherCanManageProject } from './project-access.policy';
import { applyProjectActorScope } from './infrastructure/database/project-actor-scope.util';

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
      const isAssigned = await this.projectsRepository
        .createQueryBuilder('project')
        .innerJoin('project.teachers', 'teacher')
        .where('project.id = :projectId', { projectId })
        .andWhere('teacher.id = :teacherId', { teacherId: actor.userId })
        .getExists();

      if (!isAssigned) {
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
