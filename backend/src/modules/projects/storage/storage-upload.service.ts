import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
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
} from './entities/storage-object.entity';
import { UploadedStorageFile } from './interfaces/uploaded-storage-file.interface';
import {
  computeUploadHash,
  discardUploadTempFile,
  openUploadBody,
} from './upload-payload.util';
import { StorageObjectResponse } from './storage.types';
import { toStorageObjectResponse } from './storage-response.util';
import {
  ALLOWED_STUDENT_SOURCE_EXTENSIONS,
  ALLOWED_TEST_SUITE_EXTENSIONS,
  MAX_FILE_SIZE_BYTES,
} from './storage.constants';

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

  /**
   * Multer deja el fichero en disco antes de que este método se ejecute
   * (ESC-ALTO-05), de modo que el temporal hay que borrarlo pase lo que pase:
   * por eso el cuerpo real vive en `uploadInternal` y aquí solo se envuelve en
   * un `finally`. Sin esta limpieza, cada subida rechazada por validación o por
   * permisos dejaría hasta 50 MB en el disco del contenedor de la API.
   */
  async upload(
    dto: CreateStorageObjectDto,
    file: UploadedStorageFile | undefined,
    actor: AuthenticatedUser,
  ): Promise<StorageObjectResponse> {
    try {
      return await this.uploadInternal(dto, file, actor);
    } finally {
      await discardUploadTempFile(file);
    }
  }

  private async uploadInternal(
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
    await this.storageAccessService.assertCanUploadStudentSource(
      delivery,
      actor,
    );

    const bucket = this.minioStorageService.getBucketName();
    const objectKey = this.buildDeliveryObjectKey(delivery.id, dto.logicalName);
    // El hash lo sigue calculando el servidor, no se toma del cliente: es la
    // huella de integridad del objeto almacenado y no puede depender de un valor
    // que el remitente controla. Lo que cambia con ESC-ALTO-05 es *cómo* se lee
    // el contenido —por trozos desde disco en vez de entero en memoria—, no
    // quién lo resume ni sobre qué bytes.
    const hash = await computeUploadHash(file);

    let uploadedObject = false;
    try {
      await this.minioStorageService.putObject({
        bucket,
        key: objectKey,
        body: openUploadBody(file),
        contentType: dto.contentType,
        contentLength: file.size,
      });
      uploadedObject = true;

      const storageObject = this.storageRepository.create({
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

  /** Misma envoltura de limpieza que `upload`; véase el comentario de allí. */
  async uploadProjectTestSuite(
    projectId: string,
    file: UploadedStorageFile | undefined,
    actor: AuthenticatedUser,
  ): Promise<StorageObjectResponse> {
    try {
      return await this.uploadProjectTestSuiteInternal(projectId, file, actor);
    } finally {
      await discardUploadTempFile(file);
    }
  }

  private async uploadProjectTestSuiteInternal(
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
        projectId,
        deliveryId: IsNull(),
        assetRole: StorageAssetRole.TEACHER_TESTS,
      },
    });

    const logicalName =
      path.posix.basename(file.originalname ?? 'teacher-tests.zip') ||
      'teacher-tests.zip';
    const bucket = this.minioStorageService.getBucketName();
    const objectKey = this.buildProjectTestSuiteObjectKey(
      projectId,
      logicalName,
    );
    const hash = await computeUploadHash(file);

    await this.minioStorageService.putObject({
      bucket,
      key: objectKey,
      body: openUploadBody(file),
      contentType: file.mimetype || 'application/octet-stream',
      contentLength: file.size,
    });

    let saved: StorageObject;
    try {
      saved = await this.storageRepository.save(
        this.storageRepository.create({
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
    } catch (dbError) {
      await this.minioStorageService
        .deleteObject(bucket, objectKey)
        .catch(() => undefined);
      throw dbError;
    }

    if (existing) {
      await this.minioStorageService
        .deleteObject(existing.bucket, existing.objectKey)
        .catch(() => undefined);
      await this.storageRepository.delete({ id: existing.id });
    }

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
