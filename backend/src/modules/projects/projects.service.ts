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
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { BuildRun } from './builder/domain/entities/build-run.entity';
import { UserRole } from '../users/entities/user.entity';
import { ProjectAssignment } from './assignments/entities/project-assignment.entity';
import {
  Delivery,
  DeliveryStatus,
} from './deliveries/entities/delivery.entity';
import { CreateProjectDto, UpdateProjectDto } from './dto/create-project.dto';
import {
  ListProjectsQueryDto,
  ProjectSortField,
} from './dto/list-projects-query.dto';
import {
  BuilderOutcome,
  ProjectProgressQueryDto,
} from './dto/project-progress-query.dto';
import {
  ReconcileOperationalIssueCategory,
  ReconcileOperationalIssueMode,
  ReconcileOperationalIssuesDto,
} from './dto/reconcile-operational-issues.dto';
import { Project, ProjectStatus } from './entities/project.entity';
import { ProjectRuntimeService } from './runtime/project-runtime.service';
import {
  buildPaginationMeta,
  PaginationMeta,
} from '../../shared/utils/pagination.util';
import { StorageObject } from './storage/entities/storage-object.entity';
import { MinioStorageService } from '../../shared/infrastructure/storage/minio-storage.service';

const PROJECT_SORT_COLUMNS: Record<ProjectSortField, string> = {
  createdAt: 'project.createdAt',
  updatedAt: 'project.updatedAt',
  title: 'project.title',
  status: 'project.status',
};

export interface ProjectProgressSummary {
  projectId: string;
  totalAssignments: number;
  deliveredAtLeastOnce: number;
  passedAllTests: number;
  neverDelivered: number;
  statusTotals: {
    pending: number;
    submitted: number;
    inReview: number;
    evaluated: number;
  };
  outcomeTotals: Record<BuilderOutcome, number>;
  perStudent: Array<{
    studentId: string;
    studentName: string;
    studentEmail: string;
    deliveryCount: number;
    latestStatus: DeliveryStatus | null;
    latestDeliveryId: string | null;
    latestDeliveryCreatedAt: string | null;
    latestBuilderOutcome: BuilderOutcome | null;
    grade: number | null;
    isLate: boolean;
    remainingDeliveries: number;
  }>;
}

export interface PaginatedProjectsResponse {
  data: Project[];
  meta: PaginationMeta;
}

export interface ProjectOperationalIssue {
  id: string;
  category: 'assignment' | 'delivery' | 'storage';
  severity: 'warning' | 'error';
  title: string;
  detail: string;
  projectId: string | null;
  projectTitle: string | null;
  createdAt: string | null;
}

export interface ProjectOperationalIssuesSummary {
  counts: {
    orphanAssignments: number;
    orphanDeliveries: number;
    orphanStorageObjects: number;
    revokedAssignments: number;
    lateDeliveries: number;
    ungradedEvaluatedDeliveries: number;
  };
  issues: ProjectOperationalIssue[];
}

export interface ProjectGradebookRow {
  studentId: string;
  studentName: string;
  studentEmail: string;
  groupIds: string[];
  groupLabels: string[];
  assignmentId: string;
  deliveryCount: number;
  remainingDeliveries: number;
  latestDeliveryId: string | null;
  latestDeliveryCreatedAt: string | null;
  latestStatus: DeliveryStatus | null;
  latestBuilderOutcome: BuilderOutcome | null;
  grade: number | null;
  graderNotes: string | null;
  isLate: boolean;
  lastActivityAt: string;
}

export interface ProjectOperationalIssuesReconcileResult {
  mode: ReconcileOperationalIssueMode;
  requestedCategories: ReconcileOperationalIssueCategory[];
  matched: Record<ReconcileOperationalIssueCategory, number>;
  applied: Record<ReconcileOperationalIssueCategory, number>;
  actions: Array<{
    category: ReconcileOperationalIssueCategory;
    targetId: string;
    action: string;
    outcome: 'would_apply' | 'applied' | 'failed';
    detail: string;
  }>;
}

interface ProjectOperationalIssueCandidates {
  orphanAssignments: Array<{
    id: string;
    updatedAt: Date | string | null;
    projectId: string | null;
    projectTitle: string | null;
  }>;
  orphanDeliveries: Array<{
    id: string;
    createdAt: Date | string | null;
    projectId: string | null;
    projectTitle: string | null;
  }>;
  orphanStorageObjects: Array<{
    id: string;
    createdAt: Date | string | null;
    projectId: string | null;
    projectTitle: string | null;
    bucket: string;
    objectKey: string;
  }>;
  counts: ProjectOperationalIssuesSummary['counts'];
}

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
    @InjectRepository(ProjectAssignment)
    private readonly assignmentsRepository: Repository<ProjectAssignment>,
    @InjectRepository(Delivery)
    private readonly deliveriesRepository: Repository<Delivery>,
    private readonly projectRuntimeService: ProjectRuntimeService,
    @InjectRepository(BuildRun)
    private readonly buildRunsRepository: Repository<BuildRun>,
    @InjectRepository(StorageObject)
    private readonly storageObjectsRepository: Repository<StorageObject>,
    private readonly minioStorageService: MinioStorageService,
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

    this.applyActorScope(queryBuilder, actor);

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

    this.applyActorScope(queryBuilder, actor);

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
    const project = await this.findOwnedProjectOrThrow(id, actor);

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

    const saved = await this.projectsRepository.save(project);
    return saved;
  }

  async updateStatus(
    id: string,
    status: ProjectStatus,
    actor: AuthenticatedUser,
  ): Promise<Project> {
    const project = await this.findOwnedProjectOrThrow(id, actor);
    return this.projectRuntimeService.transitionProjectStatus(project, status);
  }

  async remove(id: string): Promise<{ message: string }> {
    const project = await this.projectsRepository.findOne({ where: { id } });
    if (!project) {
      throw new NotFoundException(
        'Proyecto no encontrado para borrado logico.',
      );
    }

    await this.projectsRepository.softRemove(project);
    return { message: 'Proyecto marcado como eliminado correctamente.' };
  }

  async getOperationalIssues(
    actor: AuthenticatedUser,
  ): Promise<ProjectOperationalIssuesSummary> {
    const candidates = await this.resolveOperationalIssueCandidates(actor);

    return {
      counts: candidates.counts,
      issues: [
        ...candidates.orphanAssignments.slice(0, 4).map((row) => ({
          id: row.id,
          category: 'assignment' as const,
          severity: 'error' as const,
          title: 'Asignación inconsistente',
          detail:
            'Existe una asignación cuyo proyecto o alumno ya no está operativo y por eso se excluye de los listados docentes.',
          projectId: row.projectId,
          projectTitle: row.projectTitle,
          createdAt:
            row.updatedAt instanceof Date
              ? row.updatedAt.toISOString()
              : row.updatedAt,
        })),
        ...candidates.orphanDeliveries.slice(0, 4).map((row) => ({
          id: row.id,
          category: 'delivery' as const,
          severity: 'error' as const,
          title: 'Entrega huérfana',
          detail:
            'La entrega apunta a una asignación revocada o inconsistente. La UI la omite para evitar errores 500 y ruido operativo.',
          projectId: row.projectId,
          projectTitle: row.projectTitle,
          createdAt:
            row.createdAt instanceof Date
              ? row.createdAt.toISOString()
              : row.createdAt,
        })),
        ...candidates.orphanStorageObjects.slice(0, 4).map((row) => ({
          id: row.id,
          category: 'storage' as const,
          severity: 'warning' as const,
          title: 'Artefacto sin padre operativo',
          detail:
            'Hay un objeto de storage vinculado a un proyecto o entrega que ya no está operativo. Conviene reconciliarlo antes de acumular residuos.',
          projectId: row.projectId,
          projectTitle: row.projectTitle,
          createdAt:
            row.createdAt instanceof Date
              ? row.createdAt.toISOString()
              : row.createdAt,
        })),
      ].slice(0, 8),
    };
  }

  async reconcileOperationalIssues(
    dto: ReconcileOperationalIssuesDto,
    actor: AuthenticatedUser,
  ): Promise<ProjectOperationalIssuesReconcileResult> {
    this.assertCanInspectOperationalIssues(actor);
    const mode = dto.mode ?? 'dry-run';
    const requestedCategories: ReconcileOperationalIssueCategory[] =
      dto.categories?.length && Array.isArray(dto.categories)
        ? [...new Set(dto.categories)]
        : ['orphanAssignments', 'orphanDeliveries', 'orphanStorageObjects'];
    const candidates = await this.resolveOperationalIssueCandidates(actor);
    const matched = {
      orphanAssignments: requestedCategories.includes('orphanAssignments')
        ? candidates.orphanAssignments.length
        : 0,
      orphanDeliveries: requestedCategories.includes('orphanDeliveries')
        ? candidates.orphanDeliveries.length
        : 0,
      orphanStorageObjects: requestedCategories.includes('orphanStorageObjects')
        ? candidates.orphanStorageObjects.length
        : 0,
    } satisfies Record<ReconcileOperationalIssueCategory, number>;
    const applied = {
      orphanAssignments: 0,
      orphanDeliveries: 0,
      orphanStorageObjects: 0,
    } satisfies Record<ReconcileOperationalIssueCategory, number>;
    const actions: ProjectOperationalIssuesReconcileResult['actions'] = [];

    for (const candidate of candidates.orphanAssignments) {
      if (!requestedCategories.includes('orphanAssignments')) continue;
      if (mode === 'dry-run') {
        actions.push({
          category: 'orphanAssignments',
          targetId: candidate.id,
          action: 'revoke_assignment',
          outcome: 'would_apply',
          detail: 'La asignación se marcaría como revocada.',
        });
        continue;
      }

      const assignment = await this.assignmentsRepository.findOne({
        where: { id: candidate.id },
      });
      if (!assignment) {
        actions.push({
          category: 'orphanAssignments',
          targetId: candidate.id,
          action: 'revoke_assignment',
          outcome: 'failed',
          detail: 'La asignación ya no existe en la base de datos.',
        });
        continue;
      }
      assignment.revokedAt = assignment.revokedAt ?? new Date();
      await this.assignmentsRepository.save(assignment);
      applied.orphanAssignments += 1;
      actions.push({
        category: 'orphanAssignments',
        targetId: candidate.id,
        action: 'revoke_assignment',
        outcome: 'applied',
        detail: 'Asignación revocada para excluirla del flujo operativo.',
      });
    }

    for (const candidate of candidates.orphanDeliveries) {
      if (!requestedCategories.includes('orphanDeliveries')) continue;
      if (mode === 'dry-run') {
        actions.push({
          category: 'orphanDeliveries',
          targetId: candidate.id,
          action: 'soft_delete_delivery',
          outcome: 'would_apply',
          detail: 'La entrega se marcaría como eliminada.',
        });
        continue;
      }

      const delivery = await this.deliveriesRepository.findOne({
        where: { id: candidate.id },
      });
      if (!delivery) {
        actions.push({
          category: 'orphanDeliveries',
          targetId: candidate.id,
          action: 'soft_delete_delivery',
          outcome: 'failed',
          detail: 'La entrega ya no existe en la base de datos.',
        });
        continue;
      }
      await this.deliveriesRepository.softRemove(delivery);
      applied.orphanDeliveries += 1;
      actions.push({
        category: 'orphanDeliveries',
        targetId: candidate.id,
        action: 'soft_delete_delivery',
        outcome: 'applied',
        detail: 'Entrega marcada como eliminada para evitar ruido operativo.',
      });
    }

    for (const candidate of candidates.orphanStorageObjects) {
      if (!requestedCategories.includes('orphanStorageObjects')) continue;
      if (mode === 'dry-run') {
        actions.push({
          category: 'orphanStorageObjects',
          targetId: candidate.id,
          action: 'soft_delete_storage_object',
          outcome: 'would_apply',
          detail:
            'Se intentaría borrar el objeto físico y después marcar el registro como eliminado.',
        });
        continue;
      }

      const storageObject = await this.storageObjectsRepository.findOne({
        where: { id: candidate.id },
      });
      if (!storageObject) {
        actions.push({
          category: 'orphanStorageObjects',
          targetId: candidate.id,
          action: 'soft_delete_storage_object',
          outcome: 'failed',
          detail: 'El objeto de storage ya no existe en la base de datos.',
        });
        continue;
      }

      await this.minioStorageService
        .deleteObject(storageObject.bucket, storageObject.objectKey)
        .catch(() => undefined);
      await this.storageObjectsRepository.softRemove(storageObject);
      applied.orphanStorageObjects += 1;
      actions.push({
        category: 'orphanStorageObjects',
        targetId: candidate.id,
        action: 'soft_delete_storage_object',
        outcome: 'applied',
        detail:
          'Objeto físico eliminado cuando fue posible y registro marcado como eliminado.',
      });
    }

    return {
      mode,
      requestedCategories,
      matched,
      applied,
      actions,
    };
  }

  async getProgressSummary(
    projectId: string,
    actor: AuthenticatedUser,
    query: ProjectProgressQueryDto = {},
  ): Promise<ProjectProgressSummary> {
    const gradebook = await this.buildGradebook(
      projectId,
      actor,
      query.groupId,
    );
    const totalAssignments = gradebook.length;
    let deliveredAtLeastOnce = 0;
    let passedAllTests = 0;
    let neverDelivered = 0;
    const statusTotals = {
      pending: 0,
      submitted: 0,
      inReview: 0,
      evaluated: 0,
    };
    const outcomeTotals: Record<BuilderOutcome, number> = {
      PASS: 0,
      FAIL: 0,
      PARTIAL: 0,
      UNKNOWN: 0,
    };

    for (const row of gradebook) {
      if (row.deliveryCount === 0) {
        neverDelivered += 1;
        statusTotals.pending += 1;
      } else {
        deliveredAtLeastOnce += 1;
        if (row.latestStatus === DeliveryStatus.SUBMITTED) {
          statusTotals.submitted += 1;
        } else if (row.latestStatus === DeliveryStatus.IN_REVIEW) {
          statusTotals.inReview += 1;
        } else if (row.latestStatus === DeliveryStatus.EVALUATED) {
          statusTotals.evaluated += 1;
        } else {
          statusTotals.pending += 1;
        }
      }

      if (row.latestBuilderOutcome) {
        outcomeTotals[row.latestBuilderOutcome] += 1;
        if (row.latestBuilderOutcome === 'PASS') {
          passedAllTests += 1;
        }
      }
    }

    return {
      projectId,
      totalAssignments,
      deliveredAtLeastOnce,
      passedAllTests,
      neverDelivered,
      statusTotals,
      outcomeTotals,
      perStudent: gradebook.map((row) => ({
        studentId: row.studentId,
        studentName: row.studentName,
        studentEmail: row.studentEmail,
        deliveryCount: row.deliveryCount,
        latestStatus: row.latestStatus,
        latestDeliveryId: row.latestDeliveryId,
        latestDeliveryCreatedAt: row.latestDeliveryCreatedAt,
        latestBuilderOutcome: row.latestBuilderOutcome,
        grade: row.grade,
        isLate: row.isLate,
        remainingDeliveries: row.remainingDeliveries,
      })),
    };
  }

  async getGradebook(
    projectId: string,
    actor: AuthenticatedUser,
    query: ProjectProgressQueryDto = {},
  ): Promise<ProjectGradebookRow[]> {
    return this.buildGradebook(projectId, actor, query.groupId);
  }

  async exportGradebookCsv(
    projectId: string,
    actor: AuthenticatedUser,
    query: ProjectProgressQueryDto,
  ): Promise<string> {
    const rows = await this.buildGradebook(projectId, actor, query.groupId);
    const filteredRows = rows.filter((student) => {
      if (
        query.deliveryStatus &&
        student.latestStatus !== query.deliveryStatus
      ) {
        return false;
      }
      if (
        query.builderOutcome &&
        student.latestBuilderOutcome !== query.builderOutcome
      ) {
        return false;
      }
      if (
        query.lateOnly !== undefined &&
        query.lateOnly.toLowerCase() === 'true' &&
        !student.isLate
      ) {
        return false;
      }
      return true;
    });

    const header = [
      'studentId',
      'studentName',
      'studentEmail',
      'groupIds',
      'groupLabels',
      'assignmentId',
      'deliveryCount',
      'remainingDeliveries',
      'latestDeliveryId',
      'latestDeliveryCreatedAt',
      'latestStatus',
      'latestBuilderOutcome',
      'grade',
      'graderNotes',
      'isLate',
      'lastActivityAt',
    ];

    return [
      header.join(','),
      ...filteredRows.map((row) =>
        [
          row.studentId,
          row.studentName,
          row.studentEmail,
          row.groupIds.join('|'),
          row.groupLabels.join('|'),
          row.assignmentId,
          String(row.deliveryCount),
          String(row.remainingDeliveries),
          row.latestDeliveryId ?? '',
          row.latestDeliveryCreatedAt ?? '',
          row.latestStatus ?? '',
          row.latestBuilderOutcome ?? '',
          row.grade ?? '',
          row.graderNotes ?? '',
          row.isLate ? 'true' : 'false',
          row.lastActivityAt,
        ]
          .map((value) => this.escapeCsv(value))
          .join(','),
      ),
    ].join('\n');
  }

  private assertCanInspectOperationalIssues(actor: AuthenticatedUser): void {
    if (actor.role === UserRole.ADMIN || actor.role === UserRole.TEACHER) {
      return;
    }

    throw new ForbiddenException(
      'No tiene permisos para consultar incidencias operativas.',
    );
  }

  private async resolveOperationalIssueCandidates(
    actor: AuthenticatedUser,
  ): Promise<ProjectOperationalIssueCandidates> {
    this.assertCanInspectOperationalIssues(actor);

    const orphanAssignmentsQuery = this.assignmentsRepository
      .createQueryBuilder('assignment')
      .leftJoin('projects', 'project', 'project.id = assignment.projectId')
      .leftJoin('users', 'student', 'student.id = assignment.studentId')
      .where('assignment.revokedAt IS NULL')
      .andWhere(
        [
          'project.id IS NULL',
          'student.id IS NULL',
          'project.deletedAt IS NOT NULL',
          'student.deletedAt IS NOT NULL',
        ].join(' OR '),
      );

    if (actor.role === UserRole.TEACHER) {
      orphanAssignmentsQuery.andWhere('project.creatorId = :creatorId', {
        creatorId: actor.userId,
      });
    }

    const orphanAssignments = await orphanAssignmentsQuery
      .clone()
      .select([
        'assignment.id AS id',
        'assignment.updatedAt AS updatedAt',
        'assignment.projectId AS projectId',
        'project.title AS projectTitle',
      ])
      .orderBy('assignment.updatedAt', 'DESC')
      .getRawMany<
        ProjectOperationalIssueCandidates['orphanAssignments'][number]
      >();

    const orphanDeliveriesQuery = this.deliveriesRepository
      .createQueryBuilder('delivery')
      .leftJoin(
        'project_assignments',
        'assignment',
        'assignment.id = delivery.assignmentId',
      )
      .leftJoin('projects', 'project', 'project.id = assignment.projectId')
      .leftJoin('users', 'student', 'student.id = assignment.studentId')
      .where(
        [
          'assignment.id IS NULL',
          'assignment.revokedAt IS NOT NULL',
          'project.id IS NULL',
          'student.id IS NULL',
          'project.deletedAt IS NOT NULL',
          'student.deletedAt IS NOT NULL',
        ].join(' OR '),
      );

    if (actor.role === UserRole.TEACHER) {
      orphanDeliveriesQuery.andWhere('project.creatorId = :creatorId', {
        creatorId: actor.userId,
      });
    }

    const orphanDeliveries = await orphanDeliveriesQuery
      .clone()
      .select([
        'delivery.id AS id',
        'delivery.createdAt AS createdAt',
        'assignment.projectId AS projectId',
        'project.title AS projectTitle',
      ])
      .orderBy('delivery.createdAt', 'DESC')
      .getRawMany<
        ProjectOperationalIssueCandidates['orphanDeliveries'][number]
      >();

    const orphanStorageQuery = this.storageObjectsRepository
      .createQueryBuilder('storage')
      .leftJoin('projects', 'project', 'project.id = storage.projectId')
      .leftJoin('deliveries', 'delivery', 'delivery.id = storage.deliveryId')
      .where(
        [
          "(storage.scopeType = 'PROJECT' AND (project.id IS NULL OR project.deletedAt IS NOT NULL))",
          "(storage.scopeType = 'DELIVERY' AND (delivery.id IS NULL OR delivery.deletedAt IS NOT NULL))",
        ].join(' OR '),
      );

    if (actor.role === UserRole.TEACHER) {
      orphanStorageQuery.andWhere('project.creatorId = :creatorId', {
        creatorId: actor.userId,
      });
    }

    const orphanStorageObjects = await orphanStorageQuery
      .clone()
      .select([
        'storage.id AS id',
        'storage.createdAt AS createdAt',
        'storage.projectId AS projectId',
        'project.title AS projectTitle',
        'storage.bucket AS bucket',
        'storage.objectKey AS objectKey',
      ])
      .orderBy('storage.createdAt', 'DESC')
      .getRawMany<
        ProjectOperationalIssueCandidates['orphanStorageObjects'][number]
      >();

    const revokedAssignmentsQuery = this.assignmentsRepository
      .createQueryBuilder('assignment')
      .leftJoin('projects', 'project', 'project.id = assignment.projectId')
      .where('assignment.revokedAt IS NOT NULL');

    const lateDeliveriesQuery = this.deliveriesRepository
      .createQueryBuilder('delivery')
      .leftJoin(
        'project_assignments',
        'assignment',
        'assignment.id = delivery.assignmentId',
      )
      .leftJoin('projects', 'project', 'project.id = assignment.projectId')
      .where('delivery.isLate = true');

    const ungradedEvaluatedQuery = this.deliveriesRepository
      .createQueryBuilder('delivery')
      .leftJoin(
        'project_assignments',
        'assignment',
        'assignment.id = delivery.assignmentId',
      )
      .leftJoin('projects', 'project', 'project.id = assignment.projectId')
      .where('delivery.status = :status', {
        status: DeliveryStatus.EVALUATED,
      })
      .andWhere('delivery.grade IS NULL');

    if (actor.role === UserRole.TEACHER) {
      const teacherScope = { creatorId: actor.userId };
      revokedAssignmentsQuery.andWhere(
        'project.creatorId = :creatorId',
        teacherScope,
      );
      lateDeliveriesQuery.andWhere(
        'project.creatorId = :creatorId',
        teacherScope,
      );
      ungradedEvaluatedQuery.andWhere(
        'project.creatorId = :creatorId',
        teacherScope,
      );
    }

    const [revokedAssignments, lateDeliveries, ungradedEvaluatedDeliveries] =
      await Promise.all([
        revokedAssignmentsQuery.getCount(),
        lateDeliveriesQuery.getCount(),
        ungradedEvaluatedQuery.getCount(),
      ]);

    return {
      orphanAssignments,
      orphanDeliveries,
      orphanStorageObjects,
      counts: {
        orphanAssignments: orphanAssignments.length,
        orphanDeliveries: orphanDeliveries.length,
        orphanStorageObjects: orphanStorageObjects.length,
        revokedAssignments,
        lateDeliveries,
        ungradedEvaluatedDeliveries,
      },
    };
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

    const restoredProject = await this.projectsRepository.findOne({
      where: { id },
    });
    if (!restoredProject) {
      throw new NotFoundException(
        'No se pudo restaurar el proyecto solicitado.',
      );
    }

    return restoredProject;
  }

  async findOwnedProjectOrThrow(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<Project> {
    const project = await this.projectsRepository.findOne({ where: { id } });
    if (!project) {
      throw new NotFoundException('Proyecto no encontrado.');
    }

    this.assertCanManageProject(project, actor);
    return project;
  }

  async exportProgressSummaryCsv(
    projectId: string,
    actor: AuthenticatedUser,
    query: ProjectProgressQueryDto,
  ): Promise<string> {
    const summary = await this.getProgressSummary(projectId, actor, query);
    const rows = summary.perStudent.filter((student) => {
      if (
        query.deliveryStatus &&
        student.latestStatus !== query.deliveryStatus
      ) {
        return false;
      }
      if (
        query.builderOutcome &&
        student.latestBuilderOutcome !== query.builderOutcome
      ) {
        return false;
      }
      if (
        query.lateOnly !== undefined &&
        query.lateOnly.toLowerCase() === 'true' &&
        !student.isLate
      ) {
        return false;
      }
      return true;
    });

    const header = [
      'studentId',
      'studentName',
      'studentEmail',
      'deliveryCount',
      'remainingDeliveries',
      'latestStatus',
      'latestBuilderOutcome',
      'grade',
      'isLate',
      'latestDeliveryCreatedAt',
    ];

    return [
      header.join(','),
      ...rows.map((row) =>
        [
          row.studentId,
          row.studentName,
          row.studentEmail,
          String(row.deliveryCount),
          String(row.remainingDeliveries),
          row.latestStatus ?? '',
          row.latestBuilderOutcome ?? '',
          row.grade ?? '',
          row.isLate ? 'true' : 'false',
          row.latestDeliveryCreatedAt ?? '',
        ]
          .map((value) => this.escapeCsv(value))
          .join(','),
      ),
    ].join('\n');
  }

  private async buildGradebook(
    projectId: string,
    actor: AuthenticatedUser,
    groupId?: string,
  ): Promise<ProjectGradebookRow[]> {
    const project = await this.projectsRepository.findOne({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('Proyecto no encontrado.');
    }
    this.assertCanManageProject(project, actor);

    const assignments = await this.assignmentsRepository.find({
      where: { projectId, revokedAt: IsNull() },
      relations: ['student', 'project'],
      order: { assignedAt: 'ASC' },
    });

    const assignmentIds = assignments.map((assignment) => assignment.id);
    const deliveries =
      assignmentIds.length === 0
        ? []
        : await this.deliveriesRepository.find({
            where: assignmentIds.map((assignmentId) => ({ assignmentId })),
            relations: {
              assignment: {
                project: true,
                student: true,
              },
            },
            order: {
              createdAt: 'ASC',
            },
          });

    const deliveriesByAssignmentId = new Map<string, Delivery[]>();
    const latestDeliveryByAssignmentId = new Map<string, Delivery>();
    for (const delivery of deliveries) {
      const current = deliveriesByAssignmentId.get(delivery.assignmentId) ?? [];
      current.push(delivery);
      deliveriesByAssignmentId.set(delivery.assignmentId, current);
      latestDeliveryByAssignmentId.set(delivery.assignmentId, delivery);
    }

    const deliveryIds = [...new Set(deliveries.map((delivery) => delivery.id))];
    const runs =
      deliveryIds.length === 0
        ? []
        : await this.buildRunsRepository.find({
            where: deliveryIds.map((deliveryId) => ({ deliveryId })),
            order: { createdAt: 'DESC' },
          });
    const latestRunByDeliveryId = new Map<string, BuildRun>();
    for (const run of runs) {
      if (!latestRunByDeliveryId.has(run.deliveryId)) {
        latestRunByDeliveryId.set(run.deliveryId, run);
      }
    }

    return assignments.map((a) => {
      const studentDeliveries = deliveriesByAssignmentId.get(a.id) ?? [];
      const count = studentDeliveries.length;
      const latestDelivery = latestDeliveryByAssignmentId.get(a.id) ?? null;
      const latestStatus = latestDelivery?.status ?? null;
      const latestRun = latestDelivery
        ? (latestRunByDeliveryId.get(latestDelivery.id) ?? null)
        : null;
      const latestBuilderOutcome = this.resolveBuilderOutcome(latestRun);

      return {
        studentId: a.studentId,
        studentName: `${a.student.firstName} ${a.student.lastName}`.trim(),
        studentEmail: a.student.email,
        groupIds: [],
        groupLabels: [],
        assignmentId: a.id,
        deliveryCount: count,
        latestStatus,
        latestDeliveryId: latestDelivery?.id ?? null,
        latestDeliveryCreatedAt:
          latestDelivery?.createdAt?.toISOString() ?? null,
        latestBuilderOutcome,
        grade: latestDelivery?.grade ?? null,
        graderNotes: latestDelivery?.graderNotes ?? null,
        isLate: latestDelivery?.isLate ?? false,
        remainingDeliveries: Math.max(
          0,
          a.project.maxDeliveriesPerStudent - count,
        ),
        lastActivityAt:
          latestDelivery?.createdAt?.toISOString() ??
          a.assignedAt.toISOString(),
      };
    });
  }

  async assertCanAccessProject(
    projectId: string,
    actor: AuthenticatedUser,
  ): Promise<Project> {
    const project = await this.projectsRepository.findOne({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('Proyecto no encontrado.');
    }

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

    return project;
  }

  private applyActorScope(
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
      .distinct(true);
  }

  private assertCanManageProject(
    project: Project,
    actor: AuthenticatedUser,
  ): void {
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

  private resolveBuilderOutcome(run: BuildRun | null): BuilderOutcome | null {
    const rawOutcome = (run?.report as { overallOutcome?: string } | null)
      ?.overallOutcome;
    if (
      rawOutcome === 'PASS' ||
      rawOutcome === 'FAIL' ||
      rawOutcome === 'PARTIAL' ||
      rawOutcome === 'UNKNOWN'
    ) {
      return rawOutcome;
    }

    return null;
  }

  private escapeCsv(value: string | number): string {
    const serialized = String(value ?? '');
    return `"${serialized.replace(/"/gu, '""')}"`;
  }
}
