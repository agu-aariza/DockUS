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
import {
  ListProjectsQueryDto,
  ProjectSortField,
} from './dto/list-projects-query.dto';
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

const PROJECT_SORT_COLUMNS: Record<ProjectSortField, string> = {
  createdAt: 'project.createdAt',
  updatedAt: 'project.updatedAt',
  title: 'project.title',
  status: 'project.status',
};

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
      return this.projectsRepository.findOne({
        where: { id },
        withDeleted: includeDeleted,
      });
    }

    const queryBuilder = this.projectsRepository
      .createQueryBuilder('project')
      .leftJoinAndSelect('project.teachers', 'teacher')
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
    const sortBy = query.sortBy;
    const sortOrder = query.sortOrder;

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

    queryBuilder.leftJoinAndSelect('project.teachers', 'teachersList');

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

  async remove(id: string): Promise<{ message: string }> {
    return this.projectLifecycleService.remove(id);
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
    return this.projectLifecycleService.restore(id);
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
