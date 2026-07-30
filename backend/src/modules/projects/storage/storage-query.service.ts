/**
 * @fileoverview Módulo de proyectos académicos y entregas (storage-query.service).
 *
 * @module storage-query.service
 */

import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import type { IObjectStorage } from '../builder/domain/ports/object-storage.port';
import { OBJECT_STORAGE } from '../builder/domain/ports/object-storage.port';
import type { IStorageObjectRepository } from '../domain/repositories/storage-object.repository.interface';
import { STORAGE_OBJECT_REPOSITORY } from '../domain/repositories/storage-object.repository.interface';
import { parseZipEntries } from '../builder/infrastructure/utils/archive-extractor.util';
import {
  DEFAULT_MAX_EXTRACTED_BYTES,
  DEFAULT_MAX_EXTRACTED_FILES,
} from '../builder/domain/builder.constants';
import { StorageAccessService } from './storage-access.service';
import { ListStorageObjectsQueryDto } from './dto/list-storage-objects-query.dto';
import { StorageObject } from './entities/storage-object.entity';
import {
  CreateDownloadUrlResponse,
  PaginatedStorageResponse,
  StorageObjectResponse,
} from './storage.types';
import { buildPaginationMeta } from '../../../shared/utils/pagination.util';
import { toStorageObjectResponse } from './storage-response.util';

const PREVIEW_ZIP_LIMITS = {
  maxTotalBytes: DEFAULT_MAX_EXTRACTED_BYTES,
  maxEntries: DEFAULT_MAX_EXTRACTED_FILES,
};

@Injectable()
export class StorageQueryService {
  constructor(
    @Inject(STORAGE_OBJECT_REPOSITORY)
    private readonly storageRepository: IStorageObjectRepository,
    @Inject(OBJECT_STORAGE)
    private readonly objectStorage: IObjectStorage,
    private readonly storageAccessService: StorageAccessService,
  ) {}

  async findAll(
    query: ListStorageObjectsQueryDto,
    actor: AuthenticatedUser,
  ): Promise<PaginatedStorageResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const createdFrom = query.createdFrom ? new Date(query.createdFrom) : null;
    const createdTo = query.createdTo ? new Date(query.createdTo) : null;

    if (createdFrom && createdTo && createdFrom > createdTo) {
      throw new BadRequestException(
        'El rango de fechas es invalido: createdFrom no puede ser mayor que createdTo.',
      );
    }

    const { data: rows, total } = await this.storageRepository.findPaginated(
      {
        deliveryId: query.deliveryId,
        projectId: query.projectId,
        assetRole: query.assetRole,
        uploaderId: query.uploaderId,
        createdFrom: createdFrom ?? undefined,
        createdTo: createdTo ?? undefined,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
        page,
        limit,
      },
      actor,
    );

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
    const downloadUrl = await this.objectStorage.createDownloadSignedUrl(
      storageObject.bucket,
      storageObject.objectKey,
    );
    const ttl = this.objectStorage.getSignedUrlTtlSeconds();
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
    return this.storageRepository.findActiveTeacherTestSuite(projectId);
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
    const storageObject =
      await this.storageRepository.findActiveStudentSource(deliveryId);
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

    const buffer = await this.objectStorage.getObjectBuffer(
      storageObject.bucket,
      storageObject.objectKey,
    );

    if (storageObject.logicalName.endsWith('.zip')) {
      const entries = parseZipEntries(buffer, PREVIEW_ZIP_LIMITS);
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

    const buffer = await this.objectStorage.getObjectBuffer(
      storageObject.bucket,
      storageObject.objectKey,
    );

    if (storageObject.logicalName.endsWith('.zip')) {
      const entries = parseZipEntries(buffer, PREVIEW_ZIP_LIMITS);
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
