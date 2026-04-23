/**
 * @fileoverview Servicio de negocio para gestion de objetos en storage.
 *
 * Contexto:
 * - Orquesta upload a MinIO + persistencia de metadatos en BD.
 * - Distingue artefactos fuente del alumno y suites docentes por proyecto.
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
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import * as path from 'path';
import {
  buildPaginationMeta,
  PaginationMeta,
} from '../../../shared/utils/pagination.util';
import { throwIfUniqueViolation } from '../../../shared/database/unique-violation.util';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../../users/entities/user.entity';
import { ProjectAssignment } from '../assignments/entities/project-assignment.entity';
import {
  Delivery,
  DeliveryStatus,
} from '../deliveries/entities/delivery.entity';
import { Project } from '../entities/project.entity';
import { CreateStorageObjectDto } from './dto/create-storage-object.dto';
import {
  ListStorageObjectsQueryDto,
  StorageSortField,
} from './dto/list-storage-objects-query.dto';
import {
  StorageAssetRole,
  StorageObject,
  StorageScopeType,
} from './entities/storage-object.entity';
import { MinioStorageService } from '../../../shared/infrastructure/storage/minio-storage.service';
import { UploadedStorageFile } from './interfaces/uploaded-storage-file.interface';

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
const ALLOWED_STUDENT_SOURCE_EXTENSIONS = new Set([
  '.zip',
  '.tar.gz',
  '.txt',
  '.md',
  '.py',
  '.json',
  '.yml',
]);
const ALLOWED_TEST_SUITE_EXTENSIONS = new Set(['.zip', '.tar.gz']);

const STORAGE_SORT_COLUMNS: Record<StorageSortField, string> = {
  createdAt: 'storage.createdAt',
  updatedAt: 'storage.updatedAt',
  logicalName: 'storage.logicalName',
  sizeBytes: 'storage.sizeBytes',
};

export type StorageObjectsPaginationMeta = PaginationMeta;

export interface StorageObjectResponse {
  id: string;
  scopeType: StorageScopeType;
  scopeId: string;
  assetRole: StorageAssetRole;
  projectId: string | null;
  deliveryId: string | null;
  logicalName: string;
  logicalPath: string;
  contentType: string;
  sizeBytes: number;
  hash: string;
  createdAt: string;
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
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
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

    if (actor.role !== UserRole.STUDENT && actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Solo estudiantes y administradores pueden subir código fuente.',
      );
    }

    this.assertFileSize(file.size);
    this.assertLogicalPathIsRelative(dto.logicalPath);
    this.assertAllowedExtension(
      dto.logicalName,
      ALLOWED_STUDENT_SOURCE_EXTENSIONS,
      'Extension no permitida. Use zip, tar.gz, txt, md, py, json o yml.',
    );

    const delivery = await this.findDeliveryOrThrow(dto.deliveryId);
    this.assertCanUploadStudentSource(delivery, actor);

    const bucket = this.minioStorageService.getBucketName();
    const objectKey = this.buildDeliveryObjectKey(delivery.id, dto.logicalName);
    const hash = dto.hash.trim();

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
        scopeType: StorageScopeType.DELIVERY,
        scopeId: delivery.id,
        assetRole: StorageAssetRole.STUDENT_SOURCE,
        projectId: delivery.assignment.projectId,
        deliveryId: delivery.id,
        logicalName: dto.logicalName.trim(),
        logicalPath: dto.logicalPath.trim(),
        contentType: dto.contentType.trim(),
        sizeBytes: file.size,
        hash,
        bucket,
        objectKey,
        uploaderId: actor.userId,
      });

      const saved = await this.storageRepository.save(storageObject);
      if (delivery.status === DeliveryStatus.DRAFT) {
        delivery.status = DeliveryStatus.SUBMITTED;
        await this.deliveriesRepository.save(delivery);
      }
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

  async uploadProjectTestSuite(
    projectId: string,
    file: UploadedStorageFile | undefined,
    actor: AuthenticatedUser,
  ): Promise<StorageObjectResponse> {
    if (!file) {
      throw new BadRequestException('No se recibio archivo de suite docente.');
    }

    const project = await this.findProjectOrThrow(projectId);
    this.assertCanManageProject(project, actor);
    this.assertFileSize(file.size);
    this.assertAllowedExtension(
      file.originalname ?? 'teacher-tests.zip',
      ALLOWED_TEST_SUITE_EXTENSIONS,
      'La suite docente debe subirse como .zip o .tar.gz.',
    );

    const existing = await this.storageRepository.findOne({
      where: {
        scopeType: StorageScopeType.PROJECT,
        scopeId: projectId,
        assetRole: StorageAssetRole.TEACHER_TESTS,
      },
    });
    if (existing) {
      await this.minioStorageService
        .deleteObject(existing.bucket, existing.objectKey)
        .catch(() => undefined);
      await this.storageRepository.delete({ id: existing.id });
    }

    const logicalName =
      path.posix.basename(file.originalname ?? 'teacher-tests.zip') ||
      'teacher-tests.zip';
    const bucket = this.minioStorageService.getBucketName();
    const objectKey = this.buildProjectTestSuiteObjectKey(
      projectId,
      logicalName,
    );
    const hash = crypto.createHash('sha256').update(file.buffer).digest('hex');

    await this.minioStorageService.putObject({
      bucket,
      key: objectKey,
      body: file.buffer,
      contentType: file.mimetype || 'application/octet-stream',
    });

    const saved = await this.storageRepository.save(
      this.storageRepository.create({
        scopeType: StorageScopeType.PROJECT,
        scopeId: projectId,
        assetRole: StorageAssetRole.TEACHER_TESTS,
        projectId,
        deliveryId: null,
        logicalName,
        logicalPath: logicalName,
        contentType: file.mimetype || 'application/octet-stream',
        sizeBytes: file.size,
        hash,
        bucket,
        objectKey,
        uploaderId: actor.userId,
      }),
    );

    return this.toResponse(saved);
  }

  async findProjectTestSuite(
    projectId: string,
    actor: AuthenticatedUser,
  ): Promise<StorageObjectResponse> {
    const storageObject = await this.findProjectTestSuiteEntity(
      projectId,
      actor,
    );
    return this.toResponse(storageObject);
  }

  async removeProjectTestSuite(
    projectId: string,
    actor: AuthenticatedUser,
  ): Promise<{ message: string }> {
    const storageObject = await this.findProjectTestSuiteEntity(
      projectId,
      actor,
    );
    await this.minioStorageService.deleteObject(
      storageObject.bucket,
      storageObject.objectKey,
    );
    await this.storageRepository.delete({ id: storageObject.id });
    return { message: 'Suite docente eliminada correctamente.' };
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
      .leftJoin(Delivery, 'delivery', 'delivery.id = storage.deliveryId')
      .leftJoin(
        ProjectAssignment,
        'assignment',
        'assignment.id = delivery.assignmentId',
      )
      .leftJoin(Project, 'project', 'project.id = assignment.projectId')
      .leftJoin(Project, 'scopeProject', 'scopeProject.id = storage.projectId');

    this.applyActorScope(queryBuilder, actor);

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

    if (query.scopeType) {
      queryBuilder.andWhere('storage.scopeType = :scopeType', {
        scopeType: query.scopeType,
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
      data: rows.map((row) => this.toResponse(row)),
      meta: buildPaginationMeta(page, limit, total),
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

  async findProjectTestSuiteStorage(
    projectId: string,
  ): Promise<StorageObject | null> {
    return this.storageRepository.findOne({
      where: {
        scopeType: StorageScopeType.PROJECT,
        scopeId: projectId,
        assetRole: StorageAssetRole.TEACHER_TESTS,
      },
    });
  }

  private async findProjectTestSuiteEntity(
    projectId: string,
    actor: AuthenticatedUser,
  ): Promise<StorageObject> {
    const project = await this.findProjectOrThrow(projectId);
    this.assertCanManageProject(project, actor);
    const storageObject = await this.findProjectTestSuiteStorage(projectId);
    if (!storageObject) {
      throw new NotFoundException(
        'El proyecto no tiene una suite docente activa.',
      );
    }

    return storageObject;
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

    if (storageObject.deliveryId) {
      const delivery = await this.findDeliveryOrThrow(storageObject.deliveryId);
      this.assertCanAccessDelivery(delivery, actor);
      return storageObject;
    }

    if (storageObject.projectId) {
      const project = await this.findProjectOrThrow(storageObject.projectId);
      if (actor.role === UserRole.ADMIN) {
        return storageObject;
      }
      if (
        actor.role === UserRole.TEACHER &&
        project.creatorId === actor.userId
      ) {
        return storageObject;
      }
      throw new ForbiddenException(
        'No tiene permisos sobre el artefacto de proyecto solicitado.',
      );
    }

    return storageObject;
  }

  private async findDeliveryOrThrow(deliveryId: string): Promise<Delivery> {
    const delivery = await this.deliveriesRepository.findOne({
      where: { id: deliveryId },
      relations: {
        assignment: {
          project: true,
          student: true,
        },
      },
    });
    if (!delivery) {
      throw new NotFoundException(
        'Entrega no encontrada para operación storage.',
      );
    }

    return delivery;
  }

  private async findProjectOrThrow(projectId: string): Promise<Project> {
    const project = await this.projectsRepository.findOne({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('Proyecto no encontrado.');
    }

    return project;
  }

  private assertCanAccessDelivery(
    delivery: Delivery,
    actor: AuthenticatedUser,
  ): void {
    if (actor.role === UserRole.ADMIN) {
      return;
    }

    if (actor.role === UserRole.STUDENT && delivery.authorId === actor.userId) {
      return;
    }

    if (
      actor.role === UserRole.TEACHER &&
      delivery.assignment.project.creatorId === actor.userId
    ) {
      return;
    }

    throw new ForbiddenException(
      'No tiene permisos sobre la entrega asociada al objeto.',
    );
  }

  private assertCanUploadStudentSource(
    delivery: Delivery,
    actor: AuthenticatedUser,
  ): void {
    this.assertCanAccessDelivery(delivery, actor);

    if (
      delivery.status === DeliveryStatus.IN_REVIEW ||
      delivery.status === DeliveryStatus.EVALUATED
    ) {
      throw new ConflictException(
        'La entrega ya está cerrada para nuevas subidas de código.',
      );
    }
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
      'No tiene permisos para administrar la suite docente del proyecto.',
    );
  }

  private applyActorScope(
    queryBuilder: ReturnType<Repository<StorageObject>['createQueryBuilder']>,
    actor: AuthenticatedUser,
  ): void {
    if (actor.role === UserRole.ADMIN) {
      return;
    }

    if (actor.role === UserRole.STUDENT) {
      queryBuilder
        .andWhere('storage.assetRole = :studentSourceRole', {
          studentSourceRole: StorageAssetRole.STUDENT_SOURCE,
        })
        .andWhere('delivery.authorId = :requestUserId', {
          requestUserId: actor.userId,
        });
      return;
    }

    queryBuilder.andWhere(
      '(project.creatorId = :requestUserId OR scopeProject.creatorId = :requestUserId)',
      {
        requestUserId: actor.userId,
      },
    );
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

  private assertAllowedExtension(
    logicalName: string,
    allowedExtensions: Set<string>,
    errorMessage: string,
  ): void {
    const normalizedName = logicalName.trim().toLowerCase();
    const extension = normalizedName.endsWith('.tar.gz')
      ? '.tar.gz'
      : path.extname(normalizedName);

    if (!allowedExtensions.has(extension)) {
      throw new BadRequestException(errorMessage);
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

  private buildDeliveryObjectKey(
    deliveryId: string,
    logicalName: string,
  ): string {
    const fileName = path.posix.basename(logicalName.trim());
    return `deliveries/${deliveryId}/student-source/${fileName}`;
  }

  private buildProjectTestSuiteObjectKey(
    projectId: string,
    logicalName: string,
  ): string {
    const fileName = path.posix.basename(logicalName.trim());
    return `projects/${projectId}/teacher-tests/${Date.now()}-${fileName}`;
  }

  private toResponse(storageObject: StorageObject): StorageObjectResponse {
    return {
      id: storageObject.id,
      scopeType: storageObject.scopeType,
      scopeId: storageObject.scopeId,
      assetRole: storageObject.assetRole,
      projectId: storageObject.projectId,
      deliveryId: storageObject.deliveryId,
      logicalName: storageObject.logicalName,
      logicalPath: storageObject.logicalPath,
      contentType: storageObject.contentType,
      sizeBytes: storageObject.sizeBytes,
      hash: storageObject.hash,
      createdAt: storageObject.createdAt.toISOString(),
      uploaderId: storageObject.uploaderId,
    };
  }

  private rethrowIfUniqueLogicalPathViolation(error: unknown): never {
    throwIfUniqueViolation(
      error,
      'Ya existe un objeto con la misma ruta logica para ese ámbito.',
    );
  }
}
