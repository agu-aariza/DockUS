/**
 * @fileoverview Adaptador TypeORM de `IStorageObjectRepository`
 * (storage-object.repository).
 *
 * @module storage-object.repository
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import type { AuthenticatedUser } from '../../../auth/interfaces/authenticated-user.interface';
import {
  StorageAssetRole,
  StorageObject,
} from '../../storage/entities/storage-object.entity';
import type { StorageSortField } from '../../storage/dto/list-storage-objects-query.dto';
import {
  IStorageObjectRepository,
  NewStorageObjectData,
  StorageListPage,
  StorageListQuery,
} from '../../domain/repositories/storage-object.repository.interface';
import { applyStorageActorScope } from './storage-actor-scope.util';

const STORAGE_SORT_COLUMNS: Record<StorageSortField, string> = {
  createdAt: 'storage.createdAt',
  updatedAt: 'storage.updatedAt',
  logicalName: 'storage.logicalName',
  sizeBytes: 'storage.sizeBytes',
};

@Injectable()
export class StorageObjectRepository implements IStorageObjectRepository {
  constructor(
    @InjectRepository(StorageObject)
    private readonly repository: Repository<StorageObject>,
  ) {}

  findByIdWithRelations(
    id: string,
    includeDeleted = false,
  ): Promise<StorageObject | null> {
    return this.repository.findOne({
      where: { id },
      withDeleted: includeDeleted,
      relations: {
        project: true,
        delivery: {
          author: true,
          assignment: {
            project: true,
          },
        },
      },
    });
  }

  async findPaginated(
    query: StorageListQuery,
    actor: AuthenticatedUser,
  ): Promise<StorageListPage> {
    const {
      deliveryId,
      projectId,
      assetRole,
      uploaderId,
      createdFrom,
      createdTo,
      sortBy,
      sortOrder,
      page,
      limit,
    } = query;

    const queryBuilder = this.repository
      .createQueryBuilder('storage')
      .leftJoinAndSelect('storage.project', 'project')
      .leftJoinAndSelect('storage.delivery', 'delivery')
      .leftJoinAndSelect('delivery.author', 'author')
      .leftJoinAndSelect('delivery.assignment', 'assignment')
      .leftJoinAndSelect('assignment.project', 'assignmentProject');

    applyStorageActorScope(queryBuilder, actor);

    if (deliveryId) {
      queryBuilder.andWhere('storage.deliveryId = :deliveryId', {
        deliveryId,
      });
    }

    if (projectId) {
      queryBuilder.andWhere('storage.projectId = :projectId', { projectId });
    }

    if (assetRole) {
      queryBuilder.andWhere('storage.assetRole = :assetRole', { assetRole });
    }

    if (uploaderId) {
      queryBuilder.andWhere('storage.uploaderId = :uploaderId', {
        uploaderId,
      });
    }

    if (createdFrom) {
      queryBuilder.andWhere('storage.createdAt >= :createdFrom', {
        createdFrom: createdFrom.toISOString(),
      });
    }

    if (createdTo) {
      queryBuilder.andWhere('storage.createdAt <= :createdTo', {
        createdTo: createdTo.toISOString(),
      });
    }

    queryBuilder
      .orderBy(STORAGE_SORT_COLUMNS[sortBy], sortOrder)
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();
    return { data, total };
  }

  findActiveTeacherTestSuite(projectId: string): Promise<StorageObject | null> {
    return this.repository.findOne({
      where: {
        projectId,
        deliveryId: IsNull(),
        assetRole: StorageAssetRole.TEACHER_TESTS,
      },
    });
  }

  findLatestTeacherTestSuite(projectId: string): Promise<StorageObject[]> {
    return this.repository.find({
      where: {
        projectId,
        deliveryId: IsNull(),
        assetRole: StorageAssetRole.TEACHER_TESTS,
      },
      order: { createdAt: 'DESC' },
      take: 1,
    });
  }

  findActiveStudentSource(deliveryId: string): Promise<StorageObject | null> {
    return this.repository.findOne({
      where: {
        deliveryId,
        assetRole: StorageAssetRole.STUDENT_SOURCE,
      },
    });
  }

  findAllStudentSourcesByDelivery(
    deliveryId: string,
  ): Promise<StorageObject[]> {
    return this.repository.find({
      where: {
        deliveryId,
        assetRole: StorageAssetRole.STUDENT_SOURCE,
      },
      order: { createdAt: 'ASC' },
    });
  }

  create(data: NewStorageObjectData): StorageObject {
    return this.repository.create(data);
  }

  save(storageObject: StorageObject): Promise<StorageObject> {
    return this.repository.save(storageObject);
  }

  softRemove(storageObject: StorageObject): Promise<StorageObject> {
    return this.repository.softRemove(storageObject);
  }

  recover(storageObject: StorageObject): Promise<StorageObject> {
    return this.repository.recover(storageObject);
  }

  async deleteById(id: string): Promise<void> {
    await this.repository.delete({ id });
  }
}
