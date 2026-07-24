/**
 * @fileoverview Servicio de negocio para gestion de proyectos.
 *
 * Contexto:
 * - Implementa alta, consulta, actualizacion, borrado logico y restauracion.
 * - Aplica visibilidad por rol y restricciones académicas sobre cupos.
 *
 * @module ProjectsService
 */

import { BadRequestException, Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import type { IProjectRepository } from './domain/repositories/project.repository.interface';
import { CreateProjectDto, UpdateProjectDto } from './dto/create-project.dto';
import { ListProjectsQueryDto } from './dto/list-projects-query.dto';
import { ProjectProgressQueryDto } from './dto/project-progress-query.dto';
import { ReconcileOperationalIssuesDto } from './dto/reconcile-operational-issues.dto';
import { Project, ProjectStatus } from './entities/project.entity';
import { ProjectGradebookService } from './project-gradebook.service';
import { ProjectLifecycleService } from './project-lifecycle.service';
import { ProjectOperationalIssuesService } from './project-operational-issues.service';
import { ProjectAccessService } from './project-access.service';
import { BuilderQualityAggregationService } from './builder/application/services/evaluation/builder-quality-aggregation.service';
import { buildPaginationMeta } from '../../shared/utils/pagination.util';
import { Delivery } from './deliveries/entities/delivery.entity';
import {
  PaginatedProjectsResponse,
  ProjectGradebookRow,
  ProjectOperationalIssuesReconcileResult,
  ProjectOperationalIssuesSummary,
  ProjectProgressSummary,
  ProjectQualityInsightsSummary,
  ProjectStudentQualityInsights,
} from './projects.types';
import type { CodeQualityCategory } from './builder/domain/builder.types';

export type {
  PaginatedProjectsResponse,
  ProjectGradebookRow,
  ProjectOperationalIssuesReconcileResult,
  ProjectOperationalIssuesSummary,
  ProjectQualityInsightsSummary,
  ProjectStudentQualityInsights,
} from './projects.types';

@Injectable()
export class ProjectsService {
  constructor(
    @Inject('IProjectRepository')
    private readonly projectsRepository: IProjectRepository,
    @InjectRepository(Delivery)
    private readonly deliveriesRepository: Repository<Delivery>,
    private readonly projectLifecycleService: ProjectLifecycleService,
    private readonly projectAccessService: ProjectAccessService,
    private readonly projectGradebookService: ProjectGradebookService,
    private readonly projectOperationalIssuesService: ProjectOperationalIssuesService,
    private readonly builderQualityAggregationService: BuilderQualityAggregationService,
  ) {}

  async findById(
    id: string,
    actor?: AuthenticatedUser,
    includeDeleted = false,
  ): Promise<Project | null> {
    if (!actor) {
      return this.projectsRepository.findById(id, { includeDeleted });
    }

    return this.projectsRepository.findByIdForActor(id, actor, {
      includeDeleted,
    });
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

    if (createdFrom && createdTo && createdFrom > createdTo) {
      throw new BadRequestException(
        'El rango de fechas es invalido: createdFrom no puede ser mayor que createdTo.',
      );
    }

    // ARQ-007: toda la construcción de la query (scoping por actor, filtros,
    // subquery de assignmentCount, orden, paginación) vive ahora en
    // ProjectRepository.findAllForActor — este servicio ya no toca
    // SelectQueryBuilder.
    const { projects, total } = await this.projectsRepository.findAllForActor(
      {
        page,
        limit,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
        status: query.status,
        creatorId: query.creatorId,
        search,
        createdFrom: createdFrom ?? undefined,
        createdTo: createdTo ?? undefined,
      },
      actor,
    );

    return {
      data: projects,
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async create(
    dto: CreateProjectDto,
    actor: AuthenticatedUser,
  ): Promise<Project> {
    return this.projectLifecycleService.create(dto, actor);
  }

  async update(
    id: string,
    dto: UpdateProjectDto,
    actor: AuthenticatedUser,
  ): Promise<Project> {
    return this.projectLifecycleService.update(id, dto, actor);
  }

  async updateStatus(
    id: string,
    status: ProjectStatus,
    actor: AuthenticatedUser,
  ): Promise<Project> {
    return this.projectLifecycleService.updateStatus(id, status, actor);
  }

  async remove(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<{ message: string }> {
    return this.projectLifecycleService.remove(id, actor);
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

  async restore(id: string, actor: AuthenticatedUser): Promise<Project> {
    return this.projectLifecycleService.restore(id, actor);
  }

  async addTeacher(
    id: string,
    teacherId: string,
    actor: AuthenticatedUser,
  ): Promise<Project> {
    return this.projectLifecycleService.addTeacher(id, teacherId, actor);
  }

  async removeTeacher(
    id: string,
    teacherId: string,
    actor: AuthenticatedUser,
  ): Promise<Project> {
    return this.projectLifecycleService.removeTeacher(id, teacherId, actor);
  }

  async getQualityInsights(
    projectId: string,
    actor: AuthenticatedUser,
  ): Promise<ProjectQualityInsightsSummary> {
    await this.projectAccessService.findOwnedProjectOrThrow(projectId, actor);
    return this.builderQualityAggregationService.getAggregatedFindings(
      projectId,
    );
  }

  async getQualityInsightsByCategory(
    projectId: string,
    category: CodeQualityCategory,
    actor: AuthenticatedUser,
  ): Promise<ProjectQualityInsightsSummary> {
    await this.projectAccessService.findOwnedProjectOrThrow(projectId, actor);
    return this.builderQualityAggregationService.getFindingsByCategory(
      projectId,
      category,
    );
  }

  async getQualityInsightsForStudent(
    projectId: string,
    studentId: string,
    actor: AuthenticatedUser,
  ): Promise<ProjectStudentQualityInsights> {
    await this.projectAccessService.findOwnedProjectOrThrow(projectId, actor);
    return this.builderQualityAggregationService.getFindingsForStudent(
      projectId,
      studentId,
    );
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
}
