import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import * as path from 'path';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { MinioStorageService } from '../../../shared/infrastructure/storage/minio-storage.service';
import { throwIfUniqueViolation } from '../../../shared/database/unique-violation.util';
import { UserRole } from '../../users/entities/user.entity';
import {
  Delivery,
  DeliveryStatus,
} from '../deliveries/entities/delivery.entity';
import { StorageAccessService } from './storage-access.service';
import { CreateStorageObjectDto } from './dto/create-storage-object.dto';
import {
  StorageAssetRole,
  StorageObject,
  StorageScopeType,
} from './entities/storage-object.entity';
import { UploadedStorageFile } from './interfaces/uploaded-storage-file.interface';
import { StorageObjectResponse } from './storage.types';
import { toStorageObjectResponse } from './storage-response.util';

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

@Injectable()
export class StorageUploadService {
  constructor(
    @InjectRepository(StorageObject)
    private readonly storageRepository: Repository<StorageObject>,
    @InjectRepository(Delivery)
    private readonly deliveriesRepository: Repository<Delivery>,
    private readonly minioStorageService: MinioStorageService,
    private readonly storageAccessService: StorageAccessService,
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

    const delivery = await this.storageAccessService.findDeliveryOrThrow(
      dto.deliveryId,
    );
    await this.storageAccessService.assertCanUploadStudentSource(delivery, actor);

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
      return toStorageObjectResponse(saved);
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

    const project =
      await this.storageAccessService.findProjectOrThrow(projectId);
    await this.storageAccessService.assertCanManageProject(project, actor);
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

    return toStorageObjectResponse(saved);
  }

  async removeProjectTestSuite(
    projectId: string,
    actor: AuthenticatedUser,
    findProjectTestSuiteEntity: (
      projectId: string,
      actor: AuthenticatedUser,
    ) => Promise<StorageObject>,
  ): Promise<{ message: string }> {
    const storageObject = await findProjectTestSuiteEntity(projectId, actor);
    await this.minioStorageService.deleteObject(
      storageObject.bucket,
      storageObject.objectKey,
    );
    await this.storageRepository.delete({ id: storageObject.id });
    return { message: 'Suite docente eliminada correctamente.' };
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

  private rethrowIfUniqueLogicalPathViolation(error: unknown): never {
    throwIfUniqueViolation(
      error,
      'Ya existe un objeto con la misma ruta logica para ese ámbito.',
    );
  }
}
