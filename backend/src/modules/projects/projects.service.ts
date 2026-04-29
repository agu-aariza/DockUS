/**
 * @fileoverview Servicio de negocio para gestion de proyectos.
 *
 * Contexto:
 * - Implementa alta, consulta, actualizacion, borrado logico y restauracion.
 * - Aplica visibilidad por rol y restricciones académicas sobre cupos.
 *
 * @module ProjectsService
 */

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { ProjectAssignment } from './assignments/entities/project-assignment.entity';
import { CreateProjectDto, UpdateProjectDto } from './dto/create-project.dto';
import {
  ListProjectsQueryDto,
  ProjectSortField,
} from './dto/list-projects-query.dto';
import { ProjectProgressQueryDto } from './dto/project-progress-query.dto';
import { ReconcileOperationalIssuesDto } from './dto/reconcile-operational-issues.dto';
import { Project, ProjectStatus } from './entities/project.entity';
import { ProjectGradebookService } from './project-gradebook.service';
import { ProjectOperationalIssuesService } from './project-operational-issues.service';
import { ProjectAccessService } from './project-access.service';
import { ProjectRuntimeService } from './runtime/project-runtime.service';
import {
  buildPaginationMeta,
} from '../../shared/utils/pagination.util';
import { Delivery } from './deliveries/entities/delivery.entity';
import {
  PaginatedProjectsResponse,
  ProjectGradebookRow,
  ProjectOperationalIssuesReconcileResult,
  ProjectOperationalIssuesSummary,
  ProjectProgressSummary,
} from './projects.types';

export type {
  PaginatedProjectsResponse,
  ProjectGradebookRow,
  ProjectOperationalIssuesReconcileResult,
  ProjectOperationalIssuesSummary,
  ProjectProgressSummary,
} from './projects.types';

const PROJECT_SORT_COLUMNS: Record<ProjectSortField, string> = {
  createdAt: 'project.createdAt',
  updatedAt: 'project.updatedAt',
  title: 'project.title',
  status: 'project.status',
};

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
    @InjectRepository(Delivery)
    private readonly deliveriesRepository: Repository<Delivery>,
    private readonly projectRuntimeService: ProjectRuntimeService,
    private readonly projectAccessService: ProjectAccessService,
    private readonly projectGradebookService: ProjectGradebookService,
    private readonly projectOperationalIssuesService: ProjectOperationalIssuesService,
  ) {}

  async findById(
    id: string,
    actor?: AuthenticatedUser,
    includeDeleted = false,
  ): Promise<Project | null> {
    if (!actor) {
      return this.projectsRepository.findOne({
        where: { id },
        withDeleted: includeDeleted,
      });
    }

    const queryBuilder = this.projectsRepository
      .createQueryBuilder('project')
      .where('project.id = :id', { id });

    this.projectAccessService.applyActorScope(queryBuilder, actor);

    if (includeDeleted) {
      queryBuilder.withDeleted();
    }

    return queryBuilder.getOne();
  }

  async findAll(
    query: ListProjectsQueryDto,
    actor: AuthenticatedUser,
  ): Promise<PaginatedProjectsResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim();
    const createdFrom = query.createdFrom ? new Date(query.createdFrom) : null;
    const createdTo = query.createdTo ? new Date(query.createdTo) : null;
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'DESC';

    const queryBuilder = this.projectsRepository.createQueryBuilder('project');

    if (createdFrom && createdTo && createdFrom > createdTo) {
      throw new BadRequestException(
        'El rango de fechas es invalido: createdFrom no puede ser mayor que createdTo.',
      );
    }

    this.projectAccessService.applyActorScope(queryBuilder, actor);

    if (query.status) {
      queryBuilder.andWhere('project.status = :status', {
        status: query.status,
      });
    }

    if (query.creatorId) {
      queryBuilder.andWhere('project.creatorId = :creatorId', {
        creatorId: query.creatorId,
      });
    }

    if (search) {
      queryBuilder.andWhere(
        '(project.title ILIKE :search OR project.contextAcademico ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (createdFrom) {
      queryBuilder.andWhere('project.createdAt >= :createdFrom', {
        createdFrom: createdFrom.toISOString(),
      });
    }

    if (createdTo) {
      queryBuilder.andWhere('project.createdAt <= :createdTo', {
        createdTo: createdTo.toISOString(),
      });
    }

    queryBuilder
      .orderBy(PROJECT_SORT_COLUMNS[sortBy], sortOrder)
      .skip((page - 1) * limit)
      .take(limit);

    const [projects, total] = await queryBuilder.getManyAndCount();

    return {
      data: projects,
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async create(dto: CreateProjectDto, creatorId: string): Promise<Project> {
    let project = this.projectsRepository.create({
      title: this.normalizeTitle(dto.title),
      contextAcademico: dto.contextAcademico?.trim() || null,
      status: dto.status ?? ProjectStatus.DRAFT,
      creatorId,
      maxDeliveriesPerStudent: dto.maxDeliveriesPerStudent ?? 1,
      expectedType: dto.expectedType?.trim() || null,
      rubricInstructions: dto.rubricInstructions?.trim() || null,
      opensAt: this.normalizeDateInput(dto.opensAt),
      closesAt: this.normalizeDateInput(dto.closesAt),
    });
    this.assertProjectWindow(project.opensAt, project.closesAt);

    project = await this.projectsRepository.save(project);
    return this.projectRuntimeService.syncCreatedProject(project);
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

    if (dto.rubricInstructions !== undefined) {
      project.rubricInstructions = dto.rubricInstructions?.trim() || null;
    }

    if (dto.opensAt !== undefined) {
      project.opensAt = this.normalizeDateInput(dto.opensAt);
    }

    if (dto.closesAt !== undefined) {
      project.closesAt = this.normalizeDateInput(dto.closesAt);
    }

    this.assertProjectWindow(project.opensAt, project.closesAt);

    if (dto.status !== undefined) {
      return this.projectRuntimeService.transitionProjectStatus(
        project,
        dto.status,
      );
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
    return this.projectRuntimeService.transitionProjectStatus(project, status);
  }

  async remove(id: string): Promise<{ message: string }> {
    const project = await this.projectAccessService.findProjectOrThrow(id);
    await this.projectsRepository.softRemove(project);
    return { message: 'Proyecto marcado como eliminado correctamente.' };
  }

  async getOperationalIssues(
    actor: AuthenticatedUser,
  ): Promise<ProjectOperationalIssuesSummary> {
    return this.projectOperationalIssuesService.getOperationalIssues(actor);
  }

  async reconcileOperationalIssues(
    dto: ReconcileOperationalIssuesDto,
    actor: AuthenticatedUser,
  ): Promise<ProjectOperationalIssuesReconcileResult> {
    return this.projectOperationalIssuesService.reconcileOperationalIssues(
      dto,
      actor,
    );
  }

  async getProgressSummary(
    projectId: string,
    actor: AuthenticatedUser,
    query: ProjectProgressQueryDto = {},
  ): Promise<ProjectProgressSummary> {
    return this.projectGradebookService.getProgressSummary(
      projectId,
      actor,
      query,
    );
  }

  async getGradebook(
    projectId: string,
    actor: AuthenticatedUser,
    query: ProjectProgressQueryDto = {},
  ): Promise<ProjectGradebookRow[]> {
    return this.projectGradebookService.getGradebook(projectId, actor, query);
  }

  async exportGradebookCsv(
    projectId: string,
    actor: AuthenticatedUser,
    query: ProjectProgressQueryDto,
  ): Promise<string> {
    return this.projectGradebookService.exportGradebookCsv(
      projectId,
      actor,
      query,
    );
  }

  async restore(id: string): Promise<Project> {
    const project = await this.projectsRepository.findOne({
      where: { id },
      withDeleted: true,
    });
    if (!project) {
      throw new NotFoundException('No se encontro un proyecto con ese ID.');
    }

    if (!project.deletedAt) {
      throw new ConflictException('El proyecto ya se encuentra activo.');
    }

    await this.projectsRepository.recover(project);

    return this.projectAccessService.findProjectOrThrow(id);
  }

  async findOwnedProjectOrThrow(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<Project> {
    return this.projectAccessService.findOwnedProjectOrThrow(id, actor);
  }

  async exportProgressSummaryCsv(
    projectId: string,
    actor: AuthenticatedUser,
    query: ProjectProgressQueryDto,
  ): Promise<string> {
    return this.projectGradebookService.exportProgressSummaryCsv(
      projectId,
      actor,
      query,
    );
  }

  async assertCanAccessProject(
    projectId: string,
    actor: AuthenticatedUser,
  ): Promise<Project> {
    return this.projectAccessService.assertCanAccessProject(projectId, actor);
  }

  private async resolveMaxIssuedDeliveryVersion(
    projectId: string,
  ): Promise<number> {
    const row = await this.deliveriesRepository
      .createQueryBuilder('delivery')
      .withDeleted()
      .innerJoin(
        ProjectAssignment,
        'assignment',
        'assignment.id = delivery.assignmentId',
      )
      .select('MAX(delivery.version)', 'maxVersion')
      .where('assignment.projectId = :projectId', { projectId })
      .getRawOne<{ maxVersion: string | null }>();

    return Number.parseInt(row?.maxVersion ?? '0', 10) || 0;
  }

  private normalizeTitle(title: string): string {
    return title.trim();
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
