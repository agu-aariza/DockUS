/**
 * @fileoverview Servicio de consulta para entregas.
 *
 * Contexto:
 * - Responsable de lecturas, paginación, proyección de respuestas y scopes de actor.
 * - No contiene lógica de mutación; solo expone el estado de las entregas.
 *
 * @module DeliveriesQueryService
 */

import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import {
  buildPaginationMeta,
  PaginationMeta,
} from '../../../shared/utils/pagination.util';
import { ListDeliveriesQueryDto } from './dto/list-deliveries-query.dto';
import { Delivery } from './entities/delivery.entity';
import type { IDeliveryRepository } from '../domain/repositories/delivery.repository.interface';
import { DELIVERY_REPOSITORY } from '../domain/repositories/delivery.repository.interface';
import { StorageService } from '../storage/storage.service';

export type { DeliveryResponse } from '@dockus/contracts';
import type { DeliveryResponse } from '@dockus/contracts';

export type DeliveriesPaginationMeta = PaginationMeta;

export interface PaginatedDeliveriesResponse {
  data: DeliveryResponse[];
  meta: DeliveriesPaginationMeta;
}

@Injectable()
export class DeliveriesQueryService {
  constructor(
    @Inject(DELIVERY_REPOSITORY)
    private readonly deliveriesRepository: IDeliveryRepository,
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
    if (!actor) {
      return this.deliveriesRepository.findByIdWithAssignment(id, {
        includeDeleted,
      });
    }

    return this.deliveriesRepository.findByIdForActor(id, actor, {
      includeDeleted,
    });
  }

  async findAll(
    query: ListDeliveriesQueryDto,
    actor: AuthenticatedUser,
  ): Promise<PaginatedDeliveriesResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const sortBy = query.sortBy;
    const sortOrder = query.sortOrder;

    const { deliveries, total } =
      await this.deliveriesRepository.findAllForActor(
        {
          page,
          limit,
          sortBy,
          sortOrder,
          projectId: query.projectId,
          assignmentId: query.assignmentId,
          authorId: query.authorId,
          status: query.status,
        },
        actor,
      );

    const assignmentIds = Array.from(
      new Set(deliveries.map((d) => d.assignmentId).filter(Boolean)),
    );
    const maxVersionsMap =
      assignmentIds.length > 0
        ? await this.deliveriesRepository.resolveMaxVersionsByAssignmentIds(
            assignmentIds,
          )
        : new Map<string, number>();

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

  resolveCurrentMaxVersion(assignmentId: string): Promise<number> {
    return this.deliveriesRepository.resolveMaxVersionForAssignment(
      assignmentId,
    );
  }
}
