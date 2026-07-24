/**
 * @fileoverview Servicio de consulta para entregas.
 *
 * Contexto:
 * - Responsable de lecturas, paginación, proyección de respuestas y scopes de actor.
 * - No contiene lógica de mutación; solo expone el estado de las entregas.
 *
 * @module DeliveriesQueryService
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../../users/entities/user.entity';
import {
  buildPaginationMeta,
  PaginationMeta,
} from '../../../shared/utils/pagination.util';
import {
  DeliverySortField,
  ListDeliveriesQueryDto,
} from './dto/list-deliveries-query.dto';
import { Delivery } from './entities/delivery.entity';
import { StorageService } from '../storage/storage.service';

export type { DeliveryResponse } from '@dockus/contracts';
import type { DeliveryResponse } from '@dockus/contracts';

export type DeliveriesPaginationMeta = PaginationMeta;

export interface PaginatedDeliveriesResponse {
  data: DeliveryResponse[];
  meta: DeliveriesPaginationMeta;
}

const DELIVERY_SORT_COLUMNS: Record<DeliverySortField, string> = {
  createdAt: 'delivery.createdAt',
  updatedAt: 'delivery.updatedAt',
  version: 'delivery.version',
  status: 'delivery.status',
};

@Injectable()
export class DeliveriesQueryService {
  constructor(
    @InjectRepository(Delivery)
    private readonly deliveriesRepository: Repository<Delivery>,
    private readonly storageService: StorageService,
  ) {}

  async preview(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<Array<{ path: string; content: string }>> {
    const delivery = await this.findEntityById(id, actor);
    if (!delivery) {
      throw new NotFoundException('Entrega no encontrada para previsualizar.');
    }
    return this.storageService.previewDelivery(id, actor);
  }

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
    const sortBy = query.sortBy;
    const sortOrder = query.sortOrder;

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

    const assignmentIds = Array.from(
      new Set(deliveries.map((d) => d.assignmentId).filter(Boolean)),
    );
    const maxVersionsMap = new Map<string, number>();

    if (assignmentIds.length > 0) {
      const results = await this.deliveriesRepository
        .createQueryBuilder('delivery')
        .withDeleted()
        .select('delivery.assignmentId', 'assignmentId')
        .addSelect('MAX(delivery.version)', 'maxVersion')
        .where('delivery.assignmentId IN (:...assignmentIds)', {
          assignmentIds,
        })
        .groupBy('delivery.assignmentId')
        .getRawMany<{ assignmentId: string; maxVersion: string | null }>();

      for (const r of results) {
        maxVersionsMap.set(
          r.assignmentId,
          Number.parseInt(r.maxVersion ?? '0', 10) || 0,
        );
      }
    }

    return {
      data: await Promise.all(
        deliveries.map((delivery) =>
          this.toResponse(delivery, maxVersionsMap.get(delivery.assignmentId)),
        ),
      ),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async toResponse(
    delivery: Delivery,
    deliveryCountOverride?: number,
  ): Promise<DeliveryResponse> {
    const deliveryCount =
      deliveryCountOverride ??
      (await this.resolveCurrentMaxVersion(delivery.assignmentId));
    const assignment = delivery.assignment;
    const project = assignment?.project;
    const student = assignment?.student;
    const studentName = student
      ? `${student.lastName}, ${student.firstName}`.trim()
      : 'Alumno no disponible';
    const maxDeliveriesPerStudent =
      project?.maxDeliveriesPerStudent ?? deliveryCount;

    return {
      id: delivery.id,
      assignmentId: delivery.assignmentId,
      projectId: assignment?.projectId,
      projectTitle: project?.title ?? 'Proyecto no disponible',
      authorId: delivery.authorId,
      studentEmail: student?.email,
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
      deletedAt: delivery.deletedAt?.toISOString(),
    };
  }

  applyActorScope(
    queryBuilder: ReturnType<Repository<Delivery>['createQueryBuilder']>,
    actor: AuthenticatedUser,
  ): void {
    if (actor.role === UserRole.ADMIN) {
      return;
    }

    if (actor.role === UserRole.TEACHER) {
      // Un co-docente asignado (no solo el creador original) debe poder ver
      // las entregas del proyecto: es la misma politica que ya aplican
      // ProjectAccessService/StorageAccessService/BuilderAccessService (ver
      // isTeacherAssignedToProject). Filtrar por creatorId aqui los dejaba
      // bloqueados de este listado aunque pudieran ejecutar el builder o ver
      // el gradebook del mismo proyecto.
      queryBuilder
        .innerJoin('project.teachers', 'scopedTeacher')
        .andWhere('scopedTeacher.id = :requestUserId', {
          requestUserId: actor.userId,
        });
      return;
    }

    queryBuilder.andWhere('delivery.authorId = :requestUserId', {
      requestUserId: actor.userId,
    });
  }

  async resolveCurrentMaxVersion(assignmentId: string): Promise<number> {
    const row = await this.deliveriesRepository
      .createQueryBuilder('delivery')
      .withDeleted()
      .select('MAX(delivery.version)', 'maxVersion')
      .where('delivery.assignmentId = :assignmentId', { assignmentId })
      .getRawOne<{ maxVersion: string | null }>();

    return Number.parseInt(row?.maxVersion ?? '0', 10) || 0;
  }
}
