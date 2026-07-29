/**
 * @fileoverview Módulo de proyectos académicos y entregas (project-lifecycle.service).
 *
 * @module project-lifecycle.service
 */

import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import {
  CreateProjectDto,
  RubricCriterionDto,
  UpdateProjectDto,
} from './dto/create-project.dto';
import {
  Project,
  ProjectStatus,
  type RubricCriterion,
} from './entities/project.entity';
import { ProjectAccessService } from './project-access.service';
import type { IDeliveryRepository } from './domain/repositories/delivery.repository.interface';
import { DELIVERY_REPOSITORY } from './domain/repositories/delivery.repository.interface';
import type { IProjectRepository } from './domain/repositories/project.repository.interface';
import { PROJECT_REPOSITORY } from './domain/repositories/project.repository.interface';

import { ProjectAssignmentsService } from './assignments/project-assignments.service';

@Injectable()
export class ProjectLifecycleService {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projectsRepository: IProjectRepository,
    @Inject(DELIVERY_REPOSITORY)
    private readonly deliveriesRepository: IDeliveryRepository,
    private readonly projectAccessService: ProjectAccessService,
    private readonly projectAssignmentsService: ProjectAssignmentsService,
  ) {}

  async create(
    dto: CreateProjectDto,
    actor: AuthenticatedUser,
  ): Promise<Project> {
    let project = this.projectsRepository.create({
      title: this.normalizeTitle(dto.title),
      contextAcademico: dto.contextAcademico?.trim() || null,
      status: dto.status ?? ProjectStatus.DRAFT,
      creatorId: actor.userId,
      maxDeliveriesPerStudent: dto.maxDeliveriesPerStudent ?? 1,
      expectedType: dto.expectedType?.trim() || null,
      expectedOutput: dto.expectedOutput?.trim() || null,
      rubricInstructions: dto.rubricInstructions?.trim() || null,
      rubricCriteria: this.normalizeRubricCriteria(dto.rubricCriteria),
      opensAt: this.normalizeDateInput(dto.opensAt),
      closesAt: this.normalizeDateInput(dto.closesAt),
      teachers: [{ id: actor.userId }],
    });
    this.assertProjectWindow(project.opensAt, project.closesAt);

    project = await this.projectsRepository.save(project);

    // Si se indicaron grupos a matricular al crear el proyecto
    if (dto.assignedGroupIds && dto.assignedGroupIds.length > 0) {
      await this.projectAssignmentsService.createBulk(
        project.id,
        { groupIds: dto.assignedGroupIds },
        actor,
      );
    }

    return project;
  }

  async update(
    id: string,
    dto: UpdateProjectDto,
    actor: AuthenticatedUser,
  ): Promise<Project> {
    const project = await this.projectAccessService.findOwnedProjectOrThrow(
      id,
      actor,
    );

    if (dto.title !== undefined) {
      project.title = this.normalizeTitle(dto.title);
    }

    if (dto.contextAcademico !== undefined) {
      project.contextAcademico = dto.contextAcademico.trim() || null;
    }

    if (dto.maxDeliveriesPerStudent !== undefined) {
      const maxIssuedVersion = await this.resolveMaxIssuedDeliveryVersion(id);
      if (dto.maxDeliveriesPerStudent < maxIssuedVersion) {
        throw new ConflictException(
          `No se puede reducir el cupo por debajo del mayor ordinal ya emitido (${maxIssuedVersion}).`,
        );
      }
      project.maxDeliveriesPerStudent = dto.maxDeliveriesPerStudent;
    }

    if (dto.expectedType !== undefined) {
      project.expectedType = dto.expectedType?.trim() || null;
    }

    if (dto.expectedOutput !== undefined) {
      project.expectedOutput = dto.expectedOutput?.trim() || null;
    }

    if (dto.rubricInstructions !== undefined) {
      project.rubricInstructions = dto.rubricInstructions?.trim() || null;
    }

    if (dto.rubricCriteria !== undefined) {
      project.rubricCriteria = this.normalizeRubricCriteria(dto.rubricCriteria);
    }

    if (dto.opensAt !== undefined) {
      project.opensAt = this.normalizeDateInput(dto.opensAt);
    }

    if (dto.closesAt !== undefined) {
      project.closesAt = this.normalizeDateInput(dto.closesAt);
    }

    this.assertProjectWindow(project.opensAt, project.closesAt);

    if (dto.status !== undefined) {
      project.status = dto.status;
    }

    return this.projectsRepository.save(project);
  }

  async updateStatus(
    id: string,
    status: ProjectStatus,
    actor: AuthenticatedUser,
  ): Promise<Project> {
    const project = await this.projectAccessService.findOwnedProjectOrThrow(
      id,
      actor,
    );
    project.status = status;
    return this.projectsRepository.save(project);
  }

  async remove(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<{ message: string }> {
    const project = await this.projectAccessService.findOwnedProjectOrThrow(
      id,
      actor,
    );
    await this.projectsRepository.softRemove(project);
    return { message: 'Proyecto marcado como eliminado correctamente.' };
  }

  async restore(id: string, actor: AuthenticatedUser): Promise<Project> {
    const project = await this.projectsRepository.findById(id, {
      includeDeleted: true,
    });
    if (!project) {
      throw new NotFoundException('No se encontro un proyecto con ese ID.');
    }

    await this.projectAccessService.assertCanManageProject(project, actor);

    if (!project.deletedAt) {
      throw new ConflictException('El proyecto ya se encuentra activo.');
    }

    await this.projectsRepository.recover(project);

    return this.projectAccessService.findProjectOrThrow(id);
  }

  async addTeacher(
    id: string,
    teacherId: string,
    actor: AuthenticatedUser,
  ): Promise<Project> {
    const project = await this.projectAccessService.findOwnedProjectOrThrow(
      id,
      actor,
    );
    const teacherIds = await this.projectsRepository.listTeacherIds(id);

    if (teacherIds.includes(teacherId)) {
      return project;
    }

    await this.projectsRepository.addTeacher(id, teacherId);

    return this.projectAccessService.findProjectOrThrow(id);
  }

  async removeTeacher(
    id: string,
    teacherId: string,
    actor: AuthenticatedUser,
  ): Promise<Project> {
    await this.projectAccessService.findOwnedProjectOrThrow(id, actor);
    const teacherIds = await this.projectsRepository.listTeacherIds(id);

    if (teacherIds.length <= 1) {
      throw new BadRequestException(
        'No se puede eliminar al único profesor asignado al proyecto.',
      );
    }

    await this.projectsRepository.removeTeacher(id, teacherId);

    return this.projectAccessService.findProjectOrThrow(id);
  }

  private resolveMaxIssuedDeliveryVersion(projectId: string): Promise<number> {
    return this.deliveriesRepository.resolveMaxVersionForProject(projectId);
  }

  private normalizeTitle(title: string): string {
    return title.trim();
  }

  /**
   * Sanea los criterios de rúbrica: recorta textos, descarta criterios sin
   * nombre y devuelve `null` cuando no queda ninguno. La validación de que los
   * pesos suman 100 ya la garantiza el DTO de entrada.
   */
  private normalizeRubricCriteria(
    criteria?: RubricCriterionDto[] | null,
  ): RubricCriterion[] | null {
    if (!criteria || criteria.length === 0) {
      return null;
    }

    const normalized = criteria
      .map((criterion) => ({
        name: criterion.name?.trim() ?? '',
        weight: criterion.weight,
        description: criterion.description?.trim() || null,
      }))
      .filter((criterion) => criterion.name.length > 0);

    return normalized.length > 0 ? normalized : null;
  }

  private normalizeDateInput(value?: string | null): Date | null {
    const normalized = value?.trim();
    if (!normalized) {
      return null;
    }

    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Se recibió una fecha inválida.');
    }

    return parsed;
  }

  private assertProjectWindow(
    opensAt: Date | null,
    closesAt: Date | null,
  ): void {
    if (opensAt && closesAt && opensAt.getTime() > closesAt.getTime()) {
      throw new BadRequestException(
        'opensAt no puede ser posterior a closesAt.',
      );
    }
  }
}
