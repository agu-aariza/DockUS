/**
 * @fileoverview Servicio de negocio para gestion de entregas.
 *
 * Contexto:
 * - Implementa alta, consulta, actualizacion y ciclo soft delete.
 * - Genera ordinales por asignación y deriva progreso por alumno/proyecto.
 *
 * @module DeliveriesService
 */

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../../users/entities/user.entity';
import { ProjectStatus } from '../entities/project.entity';
import { ProjectAssignment } from '../assignments/entities/project-assignment.entity';
import {
  buildPaginationMeta,
  PaginationMeta,
} from '../../../shared/utils/pagination.util';
import { throwIfUniqueViolation } from '../../../shared/database/unique-violation.util';
import {
  CreateDeliveryDto,
  UpdateDeliveryGradingDto,
  UpdateDeliveryDto,
} from './dto/create-delivery.dto';
import {
  DeliverySortField,
  ListDeliveriesQueryDto,
} from './dto/list-deliveries-query.dto';
import { Delivery, DeliveryStatus } from './entities/delivery.entity';

const DELIVERY_SORT_COLUMNS: Record<DeliverySortField, string> = {
  createdAt: 'delivery.createdAt',
  updatedAt: 'delivery.updatedAt',
  version: 'delivery.version',
  status: 'delivery.status',
};

export interface DeliveryResponse {
  id: string;
  assignmentId: string;
  projectId: string;
  projectTitle: string;
  authorId: string;
  studentEmail: string;
  studentName: string;
  version: number;
  status: DeliveryStatus;
  notes: string | null;
  isLate: boolean;
  grade: number | null;
  graderNotes: string | null;
  deliveryCount: number;
  remainingDeliveries: number;
  minimumRequirementMet: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export type DeliveriesPaginationMeta = PaginationMeta;

export interface PaginatedDeliveriesResponse {
  data: DeliveryResponse[];
  meta: DeliveriesPaginationMeta;
}

@Injectable()
export class DeliveriesService {
  constructor(
    @InjectRepository(Delivery)
    private readonly deliveriesRepository: Repository<Delivery>,
    @InjectRepository(ProjectAssignment)
    private readonly assignmentsRepository: Repository<ProjectAssignment>,
  ) {}

  async findById(
    id: string,
    actor: AuthenticatedUser,
    includeDeleted = false,
  ): Promise<DeliveryResponse | null> {
    const delivery = await this.findEntityById(id, actor, includeDeleted);
    if (!delivery) {
      return null;
    }

    return this.toResponse(delivery);
  }

  async findEntityById(
    id: string,
    actor?: AuthenticatedUser,
    includeDeleted = false,
  ): Promise<Delivery | null> {
    const queryBuilder = this.deliveriesRepository
      .createQueryBuilder('delivery')
      .innerJoinAndSelect('delivery.assignment', 'assignment')
      .innerJoinAndSelect('assignment.project', 'project')
      .innerJoinAndSelect('assignment.student', 'student')
      .where('delivery.id = :id', { id });

    if (includeDeleted) {
      queryBuilder.withDeleted();
    }

    if (actor) {
      this.applyActorScope(queryBuilder, actor);
    }

    return queryBuilder.getOne();
  }

  async findAll(
    query: ListDeliveriesQueryDto,
    actor: AuthenticatedUser,
  ): Promise<PaginatedDeliveriesResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'DESC';

    const queryBuilder = this.deliveriesRepository
      .createQueryBuilder('delivery')
      .innerJoinAndSelect('delivery.assignment', 'assignment')
      .innerJoinAndSelect('assignment.project', 'project')
      .innerJoinAndSelect('assignment.student', 'student');

    this.applyActorScope(queryBuilder, actor);

    if (query.projectId) {
      queryBuilder.andWhere('assignment.projectId = :projectId', {
        projectId: query.projectId,
      });
    }

    if (query.assignmentId) {
      queryBuilder.andWhere('delivery.assignmentId = :assignmentId', {
        assignmentId: query.assignmentId,
      });
    }

    if (query.authorId) {
      queryBuilder.andWhere('delivery.authorId = :authorId', {
        authorId: query.authorId,
      });
    }

    if (query.status) {
      queryBuilder.andWhere('delivery.status = :status', {
        status: query.status,
      });
    }

    queryBuilder
      .orderBy(DELIVERY_SORT_COLUMNS[sortBy], sortOrder)
      .skip((page - 1) * limit)
      .take(limit);

    const [deliveries, total] = await queryBuilder.getManyAndCount();

    return {
      data: await Promise.all(
        deliveries.map((delivery) => this.toResponse(delivery)),
      ),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async create(
    dto: CreateDeliveryDto,
    actor: AuthenticatedUser,
  ): Promise<DeliveryResponse> {
    const assignment = await this.findAssignmentOrThrow(dto.assignmentId);
    this.assertCanCreateDelivery(assignment, actor);

    const nextVersion =
      (await this.resolveCurrentMaxVersion(assignment.id)) + 1;
    if (nextVersion > assignment.project.maxDeliveriesPerStudent) {
      throw new ConflictException(
        'Se alcanzó el máximo de entregas permitidas para esta asignación.',
      );
    }

    const now = new Date();
    if (
      assignment.project.opensAt &&
      now.getTime() < assignment.project.opensAt.getTime()
    ) {
      throw new ConflictException(
        'El plazo de entregas aún no está abierto para este proyecto.',
      );
    }
    const isLate =
      assignment.project.closesAt !== null &&
      assignment.project.closesAt !== undefined &&
      now.getTime() > assignment.project.closesAt.getTime();

    const delivery = this.deliveriesRepository.create({
      assignmentId: assignment.id,
      authorId: assignment.studentId,
      version: nextVersion,
      status: dto.status ?? DeliveryStatus.DRAFT,
      notes: dto.notes?.trim() || null,
      isLate,
      grade: null,
      graderNotes: null,
    });

    try {
      const saved = await this.deliveriesRepository.save(delivery);
      const enriched = await this.findEntityById(saved.id, actor);
      if (!enriched) {
        throw new NotFoundException(
          'No se pudo reconstruir la entrega creada.',
        );
      }
      return this.toResponse(enriched, nextVersion);
    } catch (error) {
      throwIfUniqueViolation(
        error,
        'Ya existe una entrega con la misma versión para esa asignación.',
      );
      throw error;
    }
  }

  async update(
    id: string,
    dto: UpdateDeliveryDto,
    actor: AuthenticatedUser,
  ): Promise<DeliveryResponse> {
    const delivery = await this.findEntityForManagement(id, actor);
    if (!delivery) {
      throw new NotFoundException('Entrega no encontrada.');
    }

    if (
      dto.assignmentId !== undefined &&
      dto.assignmentId !== delivery.assignmentId
    ) {
      throw new BadRequestException(
        'La asignación de una entrega no puede modificarse.',
      );
    }

    if (dto.status !== undefined) {
      delivery.status = dto.status;
    }

    if (dto.notes !== undefined) {
      delivery.notes = dto.notes.trim() || null;
    }

    const saved = await this.deliveriesRepository.save(delivery);
    const enriched = await this.findEntityById(saved.id, actor);
    if (!enriched) {
      throw new NotFoundException(
        'No se pudo reconstruir la entrega actualizada.',
      );
    }

    return this.toResponse(enriched);
  }

  async updateStatus(
    id: string,
    status: DeliveryStatus,
    actor: AuthenticatedUser,
  ): Promise<DeliveryResponse> {
    const delivery = await this.findEntityForManagement(id, actor);
    if (!delivery) {
      throw new NotFoundException(
        'Entrega no encontrada para cambio de estado.',
      );
    }

    delivery.status = status;
    const saved = await this.deliveriesRepository.save(delivery);
    const enriched = await this.findEntityById(saved.id, actor);
    if (!enriched) {
      throw new NotFoundException(
        'No se pudo reconstruir la entrega actualizada.',
      );
    }

    return this.toResponse(enriched);
  }

  async updateGrading(
    id: string,
    dto: UpdateDeliveryGradingDto,
    actor: AuthenticatedUser,
  ): Promise<DeliveryResponse> {
    const delivery = await this.findEntityForManagement(id, actor);
    if (!delivery) {
      throw new NotFoundException('Entrega no encontrada para calificación.');
    }

    if (dto.grade !== undefined) {
      delivery.grade = dto.grade ?? null;
    }

    if (dto.graderNotes !== undefined) {
      delivery.graderNotes = dto.graderNotes?.trim() || null;
    }

    const saved = await this.deliveriesRepository.save(delivery);
    const enriched = await this.findEntityById(saved.id, actor);
    if (!enriched) {
      throw new NotFoundException(
        'No se pudo reconstruir la entrega calificada.',
      );
    }

    return this.toResponse(enriched);
  }

  async remove(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<{ message: string }> {
    const delivery = await this.findEntityForManagement(id, actor);
    if (!delivery) {
      throw new NotFoundException('Entrega no encontrada para borrado logico.');
    }

    await this.deliveriesRepository.softRemove(delivery);
    return { message: 'Entrega marcada como eliminada correctamente.' };
  }

  async restore(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<DeliveryResponse> {
    const delivery = await this.findEntityForManagement(id, actor, true);
    if (!delivery) {
      throw new NotFoundException('No se encontro una entrega con ese ID.');
    }

    if (!delivery.deletedAt) {
      throw new ConflictException('La entrega ya se encuentra activa.');
    }

    await this.deliveriesRepository.recover(delivery);

    const restoredDelivery = await this.findEntityById(id, actor);
    if (!restoredDelivery) {
      throw new NotFoundException(
        'No se pudo restaurar la entrega solicitada.',
      );
    }

    return this.toResponse(restoredDelivery);
  }

  async updateStatusInternal(
    id: string,
    status: DeliveryStatus,
  ): Promise<void> {
    const delivery = await this.deliveriesRepository.findOne({ where: { id } });
    if (!delivery) {
      throw new NotFoundException('Entrega no encontrada.');
    }

    delivery.status = status;
    await this.deliveriesRepository.save(delivery);
  }

  private async findEntityForManagement(
    id: string,
    actor: AuthenticatedUser,
    includeDeleted = false,
  ): Promise<Delivery | null> {
    const delivery = await this.findEntityById(id, actor, includeDeleted);
    if (!delivery) {
      return null;
    }

    if (actor.role === UserRole.ADMIN) {
      return delivery;
    }

    if (
      actor.role === UserRole.TEACHER &&
      delivery.assignment.project.creatorId === actor.userId
    ) {
      return delivery;
    }

    throw new ForbiddenException(
      'No tiene permisos para modificar la entrega.',
    );
  }

  private async findAssignmentOrThrow(
    assignmentId: string,
  ): Promise<
    ProjectAssignment & { project: NonNullable<ProjectAssignment['project']> }
  > {
    const assignment = await this.assignmentsRepository.findOne({
      where: { id: assignmentId },
      relations: {
        project: true,
        student: true,
      },
    });

    if (!assignment) {
      throw new NotFoundException('Asignación no encontrada.');
    }

    if (assignment.revokedAt) {
      throw new ConflictException(
        'La asignación está revocada y no admite nuevas entregas.',
      );
    }

    if (assignment.project.status !== ProjectStatus.ACTIVE) {
      throw new ConflictException(
        'El proyecto no está activo para recibir entregas.',
      );
    }

    return assignment as ProjectAssignment & {
      project: NonNullable<ProjectAssignment['project']>;
    };
  }

  private assertCanCreateDelivery(
    assignment: ProjectAssignment & {
      project: NonNullable<ProjectAssignment['project']>;
    },
    actor: AuthenticatedUser,
  ): void {
    if (actor.role === UserRole.ADMIN) {
      return;
    }

    if (
      actor.role === UserRole.STUDENT &&
      assignment.studentId === actor.userId &&
      !assignment.revokedAt
    ) {
      return;
    }

    throw new ForbiddenException(
      'No tiene permisos para crear entregas sobre esta asignación.',
    );
  }

  private applyActorScope(
    queryBuilder: ReturnType<Repository<Delivery>['createQueryBuilder']>,
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

    queryBuilder.andWhere('delivery.authorId = :requestUserId', {
      requestUserId: actor.userId,
    });
  }

  private async resolveCurrentMaxVersion(
    assignmentId: string,
  ): Promise<number> {
    const row = await this.deliveriesRepository
      .createQueryBuilder('delivery')
      .withDeleted()
      .select('MAX(delivery.version)', 'maxVersion')
      .where('delivery.assignmentId = :assignmentId', { assignmentId })
      .getRawOne<{ maxVersion: string | null }>();

    return Number.parseInt(row?.maxVersion ?? '0', 10) || 0;
  }

  private async toResponse(
    delivery: Delivery,
    deliveryCountOverride?: number,
  ): Promise<DeliveryResponse> {
    const deliveryCount =
      deliveryCountOverride ??
      (await this.resolveCurrentMaxVersion(delivery.assignmentId));
    const assignment = delivery.assignment;
    const project = assignment?.project ?? null;
    const student = assignment?.student ?? null;
    const studentName =
      `${student?.firstName ?? ''} ${student?.lastName ?? ''}`.trim() ||
      student?.email ||
      'Alumno no disponible';
    const maxDeliveriesPerStudent =
      project?.maxDeliveriesPerStudent ?? deliveryCount;

    return {
      id: delivery.id,
      assignmentId: delivery.assignmentId,
      projectId: assignment?.projectId ?? '',
      projectTitle: project?.title ?? 'Proyecto no disponible',
      authorId: delivery.authorId,
      studentEmail: student?.email ?? '',
      studentName,
      version: delivery.version,
      status: delivery.status,
      notes: delivery.notes,
      isLate: delivery.isLate,
      grade: delivery.grade ?? null,
      graderNotes: delivery.graderNotes ?? null,
      deliveryCount,
      remainingDeliveries: Math.max(0, maxDeliveriesPerStudent - deliveryCount),
      minimumRequirementMet: deliveryCount >= 1,
      createdAt: delivery.createdAt.toISOString(),
      updatedAt: delivery.updatedAt.toISOString(),
      deletedAt: delivery.deletedAt?.toISOString() ?? null,
    };
  }
}
