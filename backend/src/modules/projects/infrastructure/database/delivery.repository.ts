/**
 * @fileoverview Adaptador TypeORM del puerto `IDeliveryRepository`
 * (delivery.repository).
 *
 * @module delivery.repository
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { AuthenticatedUser } from '../../../auth/interfaces/authenticated-user.interface';
import { ProjectAssignment } from '../../assignments/entities/project-assignment.entity';
import { Delivery } from '../../deliveries/entities/delivery.entity';
import type { DeliverySortField } from '../../deliveries/dto/list-deliveries-query.dto';
import {
  DeliveryListPage,
  DeliveryListQuery,
  IDeliveryRepository,
  NewDeliveryData,
} from '../../domain/repositories/delivery.repository.interface';
import { applyDeliveryActorScope } from './delivery-actor-scope.util';

const DELIVERY_SORT_COLUMNS: Record<DeliverySortField, string> = {
  createdAt: 'delivery.createdAt',
  updatedAt: 'delivery.updatedAt',
  version: 'delivery.version',
  status: 'delivery.status',
};

@Injectable()
export class DeliveryRepository implements IDeliveryRepository {
  constructor(
    @InjectRepository(Delivery)
    private readonly repository: Repository<Delivery>,
  ) {}

  findById(
    id: string,
    options?: { includeDeleted?: boolean },
  ): Promise<Delivery | null> {
    return this.repository.findOne({
      where: { id },
      withDeleted: options?.includeDeleted ?? false,
    });
  }

  findByIdWithAssignment(
    id: string,
    options?: { includeDeleted?: boolean },
  ): Promise<Delivery | null> {
    return this.repository.findOne({
      where: { id },
      withDeleted: options?.includeDeleted ?? false,
      relations: {
        assignment: {
          project: true,
          student: true,
        },
      },
    });
  }

  findByIdForActor(
    id: string,
    actor: AuthenticatedUser,
    options?: { includeDeleted?: boolean },
  ): Promise<Delivery | null> {
    const queryBuilder = this.repository
      .createQueryBuilder('delivery')
      .innerJoinAndSelect('delivery.assignment', 'assignment')
      .innerJoinAndSelect('assignment.project', 'project')
      .innerJoinAndSelect('assignment.student', 'student')
      .where('delivery.id = :id', { id });

    if (options?.includeDeleted) {
      queryBuilder.withDeleted();
    }

    applyDeliveryActorScope(queryBuilder, actor);

    return queryBuilder.getOne();
  }

  async findAllForActor(
    query: DeliveryListQuery,
    actor: AuthenticatedUser,
  ): Promise<DeliveryListPage> {
    const { page, limit, sortBy, sortOrder } = query;

    const queryBuilder = this.repository
      .createQueryBuilder('delivery')
      .innerJoinAndSelect('delivery.assignment', 'assignment')
      .innerJoinAndSelect('assignment.project', 'project')
      .innerJoinAndSelect('assignment.student', 'student');

    applyDeliveryActorScope(queryBuilder, actor);

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

    return { deliveries, total };
  }

  findByAssignmentIds(
    assignmentIds: string[],
    options: {
      orderBy: 'createdAt' | 'version';
      orderDirection: 'ASC' | 'DESC';
    },
  ): Promise<Delivery[]> {
    if (assignmentIds.length === 0) {
      return Promise.resolve([]);
    }

    return this.repository.find({
      where: { assignmentId: In(assignmentIds) },
      order: { [options.orderBy]: options.orderDirection },
    });
  }

  findByIds(ids: string[]): Promise<Delivery[]> {
    if (ids.length === 0) {
      return Promise.resolve([]);
    }

    return this.repository.find({ where: { id: In(ids) } });
  }

  async resolveMaxVersionForAssignment(assignmentId: string): Promise<number> {
    const row = await this.repository
      .createQueryBuilder('delivery')
      .withDeleted()
      .select('MAX(delivery.version)', 'maxVersion')
      .where('delivery.assignmentId = :assignmentId', { assignmentId })
      .getRawOne<{ maxVersion: string | null }>();

    return Number.parseInt(row?.maxVersion ?? '0', 10) || 0;
  }

  async resolveMaxVersionForProject(projectId: string): Promise<number> {
    const row = await this.repository
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

  async resolveMaxVersionsByAssignmentIds(
    assignmentIds: string[],
  ): Promise<Map<string, number>> {
    if (assignmentIds.length === 0) {
      return new Map();
    }

    const rows = await this.repository
      .createQueryBuilder('delivery')
      .withDeleted()
      .select('delivery.assignmentId', 'assignmentId')
      .addSelect('MAX(delivery.version)', 'maxVersion')
      .where('delivery.assignmentId IN (:...assignmentIds)', { assignmentIds })
      .groupBy('delivery.assignmentId')
      .getRawMany<{ assignmentId: string; maxVersion: string | null }>();

    return new Map(
      rows.map((row) => [
        row.assignmentId,
        Number.parseInt(row.maxVersion ?? '0', 10) || 0,
      ]),
    );
  }

  create(data: NewDeliveryData): Delivery {
    return this.repository.create(data);
  }

  save(delivery: Delivery): Promise<Delivery> {
    return this.repository.save(delivery);
  }

  saveMany(deliveries: Delivery[]): Promise<Delivery[]> {
    return this.repository.save(deliveries);
  }

  softRemove(delivery: Delivery): Promise<Delivery> {
    return this.repository.softRemove(delivery);
  }

  softRemoveMany(deliveries: Delivery[]): Promise<Delivery[]> {
    return this.repository.softRemove(deliveries);
  }

  recover(delivery: Delivery): Promise<Delivery> {
    return this.repository.recover(delivery);
  }
}
