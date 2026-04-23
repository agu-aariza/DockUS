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
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
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
import { Project, ProjectStatus } from './entities/project.entity';
import {
  buildPaginationMeta,
  PaginationMeta,
} from '../../shared/utils/pagination.util';

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
  perStudent: Array<{
    studentId: string;
    studentEmail: string;
    deliveryCount: number;
    latestStatus: DeliveryStatus | null;
  }>;
}

export interface PaginatedProjectsResponse {
  data: Project[];
  meta: PaginationMeta;
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
    const project = this.projectsRepository.create({
      title: this.normalizeTitle(dto.title),
      contextAcademico: dto.contextAcademico?.trim() || null,
      status: dto.status ?? ProjectStatus.DRAFT,
      creatorId,
      maxDeliveriesPerStudent: dto.maxDeliveriesPerStudent ?? 1,
    });

    return this.projectsRepository.save(project);
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

    if (dto.status !== undefined) {
      project.status = dto.status;
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

    return this.projectsRepository.save(project);
  }

  async updateStatus(
    id: string,
    status: ProjectStatus,
    actor: AuthenticatedUser,
  ): Promise<Project> {
    const project = await this.findOwnedProjectOrThrow(id, actor);
    project.status = status;
    return this.projectsRepository.save(project);
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

  async getProgressSummary(
    projectId: string,
    actor: AuthenticatedUser,
  ): Promise<ProjectProgressSummary> {
    const project = await this.projectsRepository.findOne({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('Proyecto no encontrado.');
    }
    this.assertCanManageProject(project, actor);

    const assignments = await this.assignmentsRepository.find({
      where: { projectId, revokedAt: IsNull() },
      relations: ['student'],
    });

    const deliveries = await this.deliveriesRepository
      .createQueryBuilder('delivery')
      .innerJoin(
        ProjectAssignment,
        'assignment',
        'assignment.id = delivery.assignmentId',
      )
      .where('assignment.projectId = :projectId', { projectId })
      .select(['delivery.assignmentId', 'delivery.status', 'delivery.authorId'])
      .getMany();

    const deliveriesByStudent = new Map<string, typeof deliveries>();
    for (const d of deliveries) {
      const key = d.authorId;
      if (!deliveriesByStudent.has(key)) {
        deliveriesByStudent.set(key, []);
      }
      deliveriesByStudent.get(key)!.push(d);
    }

    let deliveredAtLeastOnce = 0;
    let passedAllTests = 0;
    let neverDelivered = 0;

    const perStudent = assignments.map((a) => {
      const studentDeliveries = deliveriesByStudent.get(a.studentId) ?? [];
      const count = studentDeliveries.length;
      const latestStatus =
        count > 0 ? (studentDeliveries.at(-1)?.status ?? null) : null;

      if (count === 0) neverDelivered++;
      else deliveredAtLeastOnce++;
      if (latestStatus === DeliveryStatus.EVALUATED) passedAllTests++;

      return {
        studentId: a.studentId,
        studentEmail:
          (a.student as { email?: string } | undefined)?.email ?? a.studentId,
        deliveryCount: count,
        latestStatus,
      };
    });

    return {
      projectId,
      totalAssignments: assignments.length,
      deliveredAtLeastOnce,
      passedAllTests,
      neverDelivered,
      perStudent,
    };
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
}
