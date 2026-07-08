import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { MinioStorageService } from '../../../shared/infrastructure/storage/minio-storage.service';
import { parseZipEntries } from '../builder/infrastructure/utils/archive-extractor.util';
import { ProjectAssignment } from '../assignments/entities/project-assignment.entity';
import { Delivery } from '../deliveries/entities/delivery.entity';
import { Project } from '../entities/project.entity';
import { StorageAccessService } from './storage-access.service';
import {
  ListStorageObjectsQueryDto,
  StorageSortField,
} from './dto/list-storage-objects-query.dto';
import {
  StorageAssetRole,
  StorageObject,
} from './entities/storage-object.entity';
import {
  CreateDownloadUrlResponse,
  PaginatedStorageResponse,
  StorageObjectResponse,
} from './storage.types';
import { buildPaginationMeta } from '../../../shared/utils/pagination.util';
import { toStorageObjectResponse } from './storage-response.util';

const STORAGE_SORT_COLUMNS: Record<StorageSortField, string> = {
  createdAt: 'storage.createdAt',
  updatedAt: 'storage.updatedAt',
  logicalName: 'storage.logicalName',
  sizeBytes: 'storage.sizeBytes',
};

@Injectable()
export class StorageQueryService {
  constructor(
    @InjectRepository(StorageObject)
    private readonly storageRepository: Repository<StorageObject>,
    private readonly minioStorageService: MinioStorageService,
    private readonly storageAccessService: StorageAccessService,
  ) {}

  async findAll(
    query: ListStorageObjectsQueryDto,
    actor: AuthenticatedUser,
  ): Promise<PaginatedStorageResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const sortBy = query.sortBy;
    const sortOrder = query.sortOrder;
    const createdFrom = query.createdFrom ? new Date(query.createdFrom) : null;
    const createdTo = query.createdTo ? new Date(query.createdTo) : null;

    if (createdFrom && createdTo && createdFrom > createdTo) {
      throw new BadRequestException(
        'El rango de fechas es invalido: createdFrom no puede ser mayor que createdTo.',
      );
    }

    const queryBuilder = this.storageRepository
      .createQueryBuilder('storage')
      .leftJoin(Delivery, 'delivery', 'delivery.id = storage.deliveryId')
      .leftJoin(
        ProjectAssignment,
        'assignment',
        'assignment.id = delivery.assignmentId',
      )
      .leftJoin(Project, 'project', 'project.id = assignment.projectId')
      .leftJoin(Project, 'scopeProject', 'scopeProject.id = storage.projectId')
      .leftJoinAndSelect('storage.project', 'projectRelation')
      .leftJoinAndSelect('storage.delivery', 'deliveryRelation')
      .leftJoinAndSelect('deliveryRelation.author', 'authorRelation')
      .leftJoinAndSelect('deliveryRelation.assignment', 'assignmentRelation')
      .leftJoinAndSelect(
        'assignmentRelation.project',
        'assignmentProjectRelation',
      );

    this.storageAccessService.applyActorScope(queryBuilder, actor);

    if (query.deliveryId) {
      queryBuilder.andWhere('storage.deliveryId = :deliveryId', {
        deliveryId: query.deliveryId,
      });
    }

    if (query.projectId) {
      queryBuilder.andWhere('storage.projectId = :projectId', {
        projectId: query.projectId,
      });
    }

    if (query.assetRole) {
      queryBuilder.andWhere('storage.assetRole = :assetRole', {
        assetRole: query.assetRole,
      });
    }

    if (query.uploaderId) {
      queryBuilder.andWhere('storage.uploaderId = :uploaderId', {
        uploaderId: query.uploaderId,
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

    const [rows, total] = await queryBuilder.getManyAndCount();

    return {
      data: rows.map((row) => toStorageObjectResponse(row)),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async findOne(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<StorageObjectResponse> {
    const storageObject =
      await this.storageAccessService.findStorageObjectWithAccess(id, actor);
    return toStorageObjectResponse(storageObject);
  }

  async createDownloadUrl(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<CreateDownloadUrlResponse> {
    const storageObject =
      await this.storageAccessService.findStorageObjectWithAccess(id, actor);
    const downloadUrl = await this.minioStorageService.createDownloadSignedUrl(
      storageObject.bucket,
      storageObject.objectKey,
    );
    const ttl = this.minioStorageService.getSignedUrlTtlSeconds();
    const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

    return {
      downloadUrl,
      expiresAt,
    };
  }

  async findProjectTestSuite(
    projectId: string,
    actor: AuthenticatedUser,
  ): Promise<StorageObjectResponse> {
    const storageObject = await this.findProjectTestSuiteEntity(
      projectId,
      actor,
    );
    return toStorageObjectResponse(storageObject);
  }

  async findProjectTestSuiteStorage(
    projectId: string,
  ): Promise<StorageObject | null> {
    return this.storageRepository.findOne({
      where: {
        projectId,
        deliveryId: IsNull(),
        assetRole: StorageAssetRole.TEACHER_TESTS,
      },
    });
  }

  async findProjectTestSuiteEntity(
    projectId: string,
    actor: AuthenticatedUser,
  ): Promise<StorageObject> {
    const project =
      await this.storageAccessService.findProjectOrThrow(projectId);
    await this.storageAccessService.assertCanManageProject(project, actor);
    const storageObject = await this.findProjectTestSuiteStorage(projectId);
    if (!storageObject) {
      throw new NotFoundException(
        'El proyecto no tiene una suite docente activa.',
      );
    }

    return storageObject;
  }

  async findDeliverySourceEntity(
    deliveryId: string,
    actor: AuthenticatedUser,
  ): Promise<StorageObject> {
    const storageObject = await this.storageRepository.findOne({
      where: {
        deliveryId,
        assetRole: StorageAssetRole.STUDENT_SOURCE,
      },
    });
    if (!storageObject) {
      throw new NotFoundException(
        'La entrega no tiene un archivo fuente activo.',
      );
    }
    // Verificamos acceso al objeto
    await this.storageAccessService.findStorageObjectWithAccess(
      storageObject.id,
      actor,
    );
    return storageObject;
  }

  async previewTestSuite(
    projectId: string,
    actor: AuthenticatedUser,
  ): Promise<Array<{ path: string; content: string }>> {
    const storageObject = await this.findProjectTestSuiteEntity(
      projectId,
      actor,
    );

    const buffer = await this.minioStorageService.getObjectBuffer(
      storageObject.bucket,
      storageObject.objectKey,
    );

    if (storageObject.logicalName.endsWith('.zip')) {
      const entries = parseZipEntries(buffer);
      return entries
        .filter((e) => !e.isDirectory && !e.path.startsWith('__MACOSX/'))
        .map((e) => ({
          path: e.path,
          content: e.content.toString('utf8'),
        }));
    }

    throw new BadRequestException(
      'El preview solo esta disponible para archivos .zip por ahora.',
    );
  }

  async previewDelivery(
    deliveryId: string,
    actor: AuthenticatedUser,
  ): Promise<Array<{ path: string; content: string }>> {
    const storageObject = await this.findDeliverySourceEntity(
      deliveryId,
      actor,
    );

    const buffer = await this.minioStorageService.getObjectBuffer(
      storageObject.bucket,
      storageObject.objectKey,
    );

    if (storageObject.logicalName.endsWith('.zip')) {
      const entries = parseZipEntries(buffer);
      return entries
        .filter((e) => !e.isDirectory && !e.path.startsWith('__MACOSX/'))
        .map((e) => ({
          path: e.path,
          content: e.content.toString('utf8'),
        }));
    }

    throw new BadRequestException(
      'El preview solo esta disponible para archivos .zip por ahora.',
    );
  }
}
