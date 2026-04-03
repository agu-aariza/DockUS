/**
 * @fileoverview Servicio de negocio para gestion de entregas.
 *
 * Contexto:
 * - Implementa alta, consulta, actualizacion y ciclo soft delete.
 * - Valida consistencia funcional con proyecto y version logica.
 *
 * @module DeliveriesService
 */

import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../entities/project.entity';
import {
  buildPaginationMeta,
  PaginationMeta,
} from '../../../shared/utils/pagination.util';
import { throwIfUniqueViolation } from '../../../shared/database/unique-violation.util';
import {
  CreateDeliveryDto,
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

export interface DeliveriesPaginationMeta extends PaginationMeta {}

export interface PaginatedDeliveriesResponse {
  data: Delivery[];
  meta: DeliveriesPaginationMeta;
}

@Injectable()
export class DeliveriesService {
  constructor(
    @InjectRepository(Delivery)
    private readonly deliveriesRepository: Repository<Delivery>,
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
  ) {}

  async findById(id: string, includeDeleted = false): Promise<Delivery | null> {
    return this.deliveriesRepository.findOne({
      where: { id },
      withDeleted: includeDeleted,
    });
  }

  async findAll(
    query: ListDeliveriesQueryDto,
  ): Promise<PaginatedDeliveriesResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'DESC';

    const queryBuilder =
      this.deliveriesRepository.createQueryBuilder('delivery');

    if (query.projectId) {
      queryBuilder.andWhere('delivery.projectId = :projectId', {
        projectId: query.projectId,
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
      data: deliveries,
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async create(dto: CreateDeliveryDto, authorId: string): Promise<Delivery> {
    await this.assertProjectExists(dto.projectId);

    const delivery = this.deliveriesRepository.create({
      projectId: dto.projectId,
      authorId,
      version: dto.version,
      status: dto.status ?? DeliveryStatus.DRAFT,
      notes: dto.notes?.trim() || null,
    });

    try {
      return await this.deliveriesRepository.save(delivery);
    } catch (error) {
      throwIfUniqueViolation(
        error,
        'Ya existe una entrega con la misma version para ese proyecto.',
      );
    }
  }

  async update(id: string, dto: UpdateDeliveryDto): Promise<Delivery> {
    const delivery = await this.findById(id);
    if (!delivery) {
      throw new NotFoundException('Entrega no encontrada.');
    }

    if (dto.version !== undefined) {
      delivery.version = dto.version;
    }

    if (dto.status !== undefined) {
      delivery.status = dto.status;
    }

    if (dto.notes !== undefined) {
      delivery.notes = dto.notes.trim() || null;
    }

    try {
      return await this.deliveriesRepository.save(delivery);
    } catch (error) {
      throwIfUniqueViolation(
        error,
        'Ya existe una entrega con la misma version para ese proyecto.',
      );
    }
  }

  async updateStatus(id: string, status: DeliveryStatus): Promise<Delivery> {
    const delivery = await this.findById(id);
    if (!delivery) {
      throw new NotFoundException(
        'Entrega no encontrada para cambio de estado.',
      );
    }

    delivery.status = status;
    return this.deliveriesRepository.save(delivery);
  }

  async remove(id: string): Promise<{ message: string }> {
    const delivery = await this.findById(id);
    if (!delivery) {
      throw new NotFoundException('Entrega no encontrada para borrado logico.');
    }

    await this.deliveriesRepository.softRemove(delivery);
    return { message: 'Entrega marcada como eliminada correctamente.' };
  }

  async restore(id: string): Promise<Delivery> {
    const delivery = await this.findById(id, true);
    if (!delivery) {
      throw new NotFoundException('No se encontro una entrega con ese ID.');
    }

    if (!delivery.deletedAt) {
      throw new ConflictException('La entrega ya se encuentra activa.');
    }

    await this.deliveriesRepository.recover(delivery);

    const restoredDelivery = await this.findById(id);
    if (!restoredDelivery) {
      throw new NotFoundException(
        'No se pudo restaurar la entrega solicitada.',
      );
    }

    return restoredDelivery;
  }

  private async assertProjectExists(projectId: string): Promise<void> {
    const project = await this.projectsRepository.findOne({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException(
        'No se puede crear la entrega: el proyecto asociado no existe.',
      );
    }
  }

}
