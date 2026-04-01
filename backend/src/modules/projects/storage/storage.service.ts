/**
 * @fileoverview Servicio de negocio para gestion de objetos en storage.
 *
 * Contexto:
 * - Orquesta upload a MinIO + persistencia de metadatos en BD.
 * - Aplica permisos RBAC y ownership por entrega.
 *
 * @module StorageService
 */

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import * as path from 'path';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../../users/entities/user.entity';
import { Delivery } from '../deliveries/entities/delivery.entity';
import { CreateStorageObjectDto } from './dto/create-storage-object.dto';
import {
  ListStorageObjectsQueryDto,
  StorageSortField,
} from './dto/list-storage-objects-query.dto';
import { StorageObject } from './entities/storage-object.entity';
import { MinioStorageService } from '../../../shared/infrastructure/storage/minio-storage.service';
import { UploadedStorageFile } from './interfaces/uploaded-storage-file.interface';

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
const ALLOWED_FILE_EXTENSIONS = new Set([
  '.zip',
  '.tar.gz',
  '.txt',
  '.md',
  '.py',
  '.json',
  '.yml',
]);

const STORAGE_SORT_COLUMNS: Record<StorageSortField, string> = {
  createdAt: 'storage.createdAt',
  updatedAt: 'storage.updatedAt',
  logicalName: 'storage.logicalName',
  sizeBytes: 'storage.sizeBytes',
};

export interface StorageObjectsPaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface StorageObjectResponse {
  id: string;
  deliveryId: string;
  logicalName: string;
  logicalPath: string;
  contentType: string;
  sizeBytes: number;
  hash: string;
  createdAt: Date;
  uploaderId: string;
}

export interface CreateDownloadUrlResponse {
  downloadUrl: string;
  expiresAt: string;
}

export interface PaginatedStorageResponse {
  data: StorageObjectResponse[];
  meta: StorageObjectsPaginationMeta;
}

@Injectable()
export class StorageService {
  constructor(
    @InjectRepository(StorageObject)
    private readonly storageRepository: Repository<StorageObject>,
    @InjectRepository(Delivery)
    private readonly deliveriesRepository: Repository<Delivery>,
    private readonly minioStorageService: MinioStorageService,
  ) {}

  async upload(
    dto: CreateStorageObjectDto,
    file: UploadedStorageFile | undefined,
    actor: AuthenticatedUser,
  ): Promise<StorageObjectResponse> {
    if (!file) {
      throw new BadRequestException(
        'No se recibio archivo. Use multipart/form-data con campo "file".',
      );
    }

    this.assertAllowedOperationForUpload(actor);
    this.assertFileSize(file.size);
    this.assertLogicalPathIsRelative(dto.logicalPath);
    this.assertAllowedExtension(dto.logicalName);

    const delivery = await this.findDeliveryOrThrow(dto.deliveryId);
    this.assertCanAccessDelivery(delivery, actor);

    const bucket = this.minioStorageService.getBucketName();
    const objectKey = this.buildObjectKey(
      delivery.id,
      delivery.version,
      dto.logicalName,
    );

    let uploadedObject = false;
    try {
      await this.minioStorageService.putObject({
        bucket,
        key: objectKey,
        body: file.buffer,
        contentType: dto.contentType,
      });
      uploadedObject = true;

      const storageObject = this.storageRepository.create({
        deliveryId: delivery.id,
        logicalName: dto.logicalName.trim(),
        logicalPath: dto.logicalPath.trim(),
        contentType: dto.contentType.trim(),
        sizeBytes: file.size,
        hash: dto.hash.trim(),
        bucket,
        objectKey,
        uploaderId: actor.userId,
      });

      const saved = await this.storageRepository.save(storageObject);
      return this.toResponse(saved);
    } catch (error) {
      if (uploadedObject) {
        await this.minioStorageService
          .deleteObject(bucket, objectKey)
          .catch(() => undefined);
      }
      this.rethrowIfUniqueLogicalPathViolation(error);
      throw error;
    }
  }

  async findAll(
    query: ListStorageObjectsQueryDto,
    actor: AuthenticatedUser,
  ): Promise<PaginatedStorageResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'DESC';
    const createdFrom = query.createdFrom ? new Date(query.createdFrom) : null;
    const createdTo = query.createdTo ? new Date(query.createdTo) : null;

    if (createdFrom && createdTo && createdFrom > createdTo) {
      throw new BadRequestException(
        'El rango de fechas es invalido: createdFrom no puede ser mayor que createdTo.',
      );
    }

    const queryBuilder = this.storageRepository
      .createQueryBuilder('storage')
      .leftJoin(Delivery, 'delivery', 'delivery.id = storage.deliveryId');

    if (actor.role === UserRole.STUDENT) {
      queryBuilder.andWhere('delivery.authorId = :requestUserId', {
        requestUserId: actor.userId,
      });
    }

    if (query.deliveryId) {
      queryBuilder.andWhere('storage.deliveryId = :deliveryId', {
        deliveryId: query.deliveryId,
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
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
      data: rows.map((row) => this.toResponse(row)),
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: totalPages > 0 && page < totalPages,
        hasPrevPage: totalPages > 0 && page > 1,
      },
    };
  }

  async findOne(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<StorageObjectResponse> {
    const storageObject = await this.findStorageObjectWithAccess(id, actor);
    return this.toResponse(storageObject);
  }

  async createDownloadUrl(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<CreateDownloadUrlResponse> {
    const storageObject = await this.findStorageObjectWithAccess(id, actor);
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

  async remove(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<{ message: string }> {
    this.assertTeacherOrAdmin(
      actor,
      'No tiene permisos para eliminar objetos.',
    );
    const storageObject = await this.findStorageObjectWithAccess(id, actor);
    await this.storageRepository.softRemove(storageObject);
    return {
      message: 'Objeto de storage marcado como eliminado correctamente.',
    };
  }

  async purge(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<{ message: string }> {
    this.assertAdmin(actor, 'Solo ADMIN puede purgar objetos fisicamente.');
    const storageObject = await this.findStorageObjectWithAccess(
      id,
      actor,
      true,
    );

    await this.minioStorageService.deleteObject(
      storageObject.bucket,
      storageObject.objectKey,
    );
    await this.storageRepository.delete({ id: storageObject.id });

    return { message: 'Objeto purgado fisicamente de forma correcta.' };
  }

  async restore(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<StorageObjectResponse> {
    this.assertAdmin(
      actor,
      'Solo ADMIN puede restaurar objetos eliminados logicamente.',
    );
    const storageObject = await this.findStorageObjectWithAccess(
      id,
      actor,
      true,
    );

    if (!storageObject.deletedAt) {
      throw new ConflictException('El objeto ya se encuentra activo.');
    }

    const exists = await this.minioStorageService.objectExists(
      storageObject.bucket,
      storageObject.objectKey,
    );
    if (!exists) {
      throw new NotFoundException(
        'No se puede restaurar: el objeto fisico no existe en storage.',
      );
    }

    await this.storageRepository.recover(storageObject);
    const restored = await this.findStorageObjectWithAccess(id, actor);
    return this.toResponse(restored);
  }

  private async findStorageObjectWithAccess(
    id: string,
    actor: AuthenticatedUser,
    includeDeleted = false,
  ): Promise<StorageObject> {
    const storageObject = await this.storageRepository.findOne({
      where: { id },
      withDeleted: includeDeleted,
    });

    if (!storageObject) {
      throw new NotFoundException('Objeto de storage no encontrado.');
    }

    if (actor.role === UserRole.STUDENT) {
      const delivery = await this.findDeliveryOrThrow(storageObject.deliveryId);
      this.assertCanAccessDelivery(delivery, actor);
    }

    return storageObject;
  }

  private async findDeliveryOrThrow(deliveryId: string): Promise<Delivery> {
    const delivery = await this.deliveriesRepository.findOne({
      where: { id: deliveryId },
    });
    if (!delivery) {
      throw new NotFoundException(
        'Entrega no encontrada para operación storage.',
      );
    }

    return delivery;
  }

  private assertCanAccessDelivery(
    delivery: Delivery,
    actor: AuthenticatedUser,
  ): void {
    if (actor.role === UserRole.STUDENT && delivery.authorId !== actor.userId) {
      throw new ForbiddenException(
        'No tiene permisos sobre la entrega asociada al objeto.',
      );
    }
  }

  private assertAllowedOperationForUpload(actor: AuthenticatedUser): void {
    if (
      actor.role !== UserRole.STUDENT &&
      actor.role !== UserRole.TEACHER &&
      actor.role !== UserRole.ADMIN
    ) {
      throw new ForbiddenException(
        'Rol no autorizado para subida de objetos de storage.',
      );
    }
  }

  private assertTeacherOrAdmin(
    actor: AuthenticatedUser,
    forbiddenMessage: string,
  ): void {
    if (actor.role !== UserRole.TEACHER && actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException(forbiddenMessage);
    }
  }

  private assertAdmin(
    actor: AuthenticatedUser,
    forbiddenMessage: string,
  ): void {
    if (actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException(forbiddenMessage);
    }
  }

  private assertFileSize(uploadedSize: number): void {
    if (uploadedSize > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException(
        `Tamano de archivo excedido. Maximo permitido: ${MAX_FILE_SIZE_BYTES} bytes.`,
      );
    }
  }

  private assertAllowedExtension(logicalName: string): void {
    const normalizedName = logicalName.trim().toLowerCase();
    const extension = normalizedName.endsWith('.tar.gz')
      ? '.tar.gz'
      : path.extname(normalizedName);

    if (!ALLOWED_FILE_EXTENSIONS.has(extension)) {
      throw new BadRequestException(
        'Extension no permitida. Use zip, tar.gz, txt, md, py, json o yml.',
      );
    }
  }

  private assertLogicalPathIsRelative(logicalPath: string): void {
    const trimmedPath = logicalPath.trim();
    const isWindowsAbsolute = /^[a-zA-Z]:[\\/]/.test(trimmedPath);
    const isUnixAbsolute =
      trimmedPath.startsWith('/') || trimmedPath.startsWith('\\');
    const containsTraversal = trimmedPath.split(/[\\/]/).includes('..');

    if (isWindowsAbsolute || isUnixAbsolute || containsTraversal) {
      throw new BadRequestException(
        'La ruta logica debe ser relativa y no puede contener rutas absolutas ni segmentos "..".',
      );
    }
  }

  private buildObjectKey(
    deliveryId: string,
    deliveryVersion: number,
    logicalName: string,
  ): string {
    const fileName = path.posix.basename(logicalName.trim());
    return `deliveries/${deliveryId}/v${deliveryVersion}/${fileName}`;
  }

  private toResponse(storageObject: StorageObject): StorageObjectResponse {
    return {
      id: storageObject.id,
      deliveryId: storageObject.deliveryId,
      logicalName: storageObject.logicalName,
      logicalPath: storageObject.logicalPath,
      contentType: storageObject.contentType,
      sizeBytes: storageObject.sizeBytes,
      hash: storageObject.hash,
      createdAt: storageObject.createdAt,
      uploaderId: storageObject.uploaderId,
    };
  }

  private rethrowIfUniqueLogicalPathViolation(error: unknown): never {
    const isUniqueViolation =
      error instanceof QueryFailedError &&
      (error as QueryFailedError & { driverError?: { code?: string } })
        .driverError?.code === '23505';

    if (isUniqueViolation) {
      throw new ConflictException(
        'Ya existe un objeto con la misma ruta logica para esa entrega.',
      );
    }

    throw error;
  }
}
