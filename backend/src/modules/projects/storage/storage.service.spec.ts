/**
 * @fileoverview Pruebas unitarias del servicio de storage.
 *
 * Contexto:
 * - Valida upload, permisos, signed URLs y ciclo de vida de objetos.
 * - Cubre reglas clave de tamaño, extensión y rutas lógicas.
 *
 * @module StorageServiceSpec
 */

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import {
  buildActor,
  buildDelivery,
  buildProject,
  buildStorageObject,
  buildUploadedStorageFile,
  createMinioStorageServiceMock,
} from '../../../test-support/domain-builders';
import { UserRole } from '../../users/entities/user.entity';
import type { IDeliveryRepository } from '../domain/repositories/delivery.repository.interface';
import type { IProjectRepository } from '../domain/repositories/project.repository.interface';
import type { IStorageObjectRepository } from '../domain/repositories/storage-object.repository.interface';
import { MinioStorageService } from '../../../shared/infrastructure/storage/minio-storage.service';
import { StorageAccessService } from './storage-access.service';
import { StorageQueryService } from './storage-query.service';
import { StorageService } from './storage.service';
import { StorageUploadService } from './storage-upload.service';

describe('StorageService', () => {
  let service: StorageService;

  const storageRepository = {
    create: jest.fn(),
    deleteById: jest.fn(),
    findByIdWithRelations: jest.fn(),
    findActiveTeacherTestSuite: jest.fn(),
    recover: jest.fn(),
    save: jest.fn(),
    softRemove: jest.fn(),
  };

  const deliveriesRepository = {
    findByIdWithAssignment: jest.fn(),
    save: jest.fn(),
  };

  const projectsRepository = {
    findById: jest.fn(),
    isTeacherAssignedToProject: jest.fn().mockResolvedValue(true),
  };

  const minioStorageService = createMinioStorageServiceMock();

  beforeEach(() => {
    jest.clearAllMocks();

    minioStorageService.getBucketName.mockReturnValue('dockus-storage');
    minioStorageService.getSignedUrlTtlSeconds.mockReturnValue(600);
    minioStorageService.putObject.mockResolvedValue(undefined);
    minioStorageService.deleteObject.mockResolvedValue(undefined);
    minioStorageService.objectExists.mockResolvedValue(true);

    const storageAccessService = new StorageAccessService(
      storageRepository as unknown as IStorageObjectRepository,
      deliveriesRepository as unknown as IDeliveryRepository,
      projectsRepository as unknown as IProjectRepository,
    );
    const storageQueryService = new StorageQueryService(
      storageRepository as unknown as IStorageObjectRepository,
      minioStorageService as unknown as MinioStorageService,
      storageAccessService,
    );
    const storageUploadService = new StorageUploadService(
      storageRepository as unknown as IStorageObjectRepository,
      deliveriesRepository as unknown as IDeliveryRepository,
      minioStorageService as unknown as MinioStorageService,
      storageAccessService,
    );

    service = new StorageService(
      storageRepository as unknown as IStorageObjectRepository,
      minioStorageService as unknown as MinioStorageService,
      storageAccessService,
      storageQueryService,
      storageUploadService,
    );
  });

  it('debe subir objeto y persistir metadata cuando todo es valido', async () => {
    const student = buildActor(UserRole.STUDENT, 'student-1');
    const delivery = buildDelivery({ authorId: student.userId });
    const saved = buildStorageObject({ uploaderId: student.userId });
    const file = buildUploadedStorageFile({
      buffer: Buffer.from('print(1)'),
      size: 8,
    });

    deliveriesRepository.findByIdWithAssignment.mockResolvedValue(delivery);
    storageRepository.create.mockReturnValue(saved);
    storageRepository.save.mockResolvedValue(saved);

    const result = await service.upload(
      {
        deliveryId: delivery.id,
        logicalName: 'main.py',
        logicalPath: 'src/main.py',
        contentType: 'text/x-python',
        sizeBytes: 8,
        hash: 'abc123',
      },
      file,
      student,
    );

    expect(minioStorageService.putObject).toHaveBeenCalledWith({
      bucket: 'dockus-storage',
      key: `deliveries/${delivery.id}/student-source/main.py`,
      body: file.buffer,
      contentType: 'text/x-python',
      // ESC-ALTO-05: se envía siempre la longitud. Con un `Buffer` es
      // redundante, pero con un flujo —el caso real desde que Multer escribe en
      // disco— es lo único que impide que el SDK lo acumule en memoria para
      // deducirla.
      contentLength: file.size,
    });
    expect(storageRepository.save).toHaveBeenCalled();
    expect(storageRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ sizeBytes: file.size }),
    );
    expect(result.deliveryId).toBe(delivery.id);
  });

  it('debe permitir upload sin sizeBytes declarado y usar tamano real', async () => {
    const student = buildActor(UserRole.STUDENT, 'student-1');
    const delivery = buildDelivery({ authorId: student.userId });
    const saved = buildStorageObject({
      uploaderId: student.userId,
      sizeBytes: 8,
    });
    const file = buildUploadedStorageFile({
      buffer: Buffer.from('print(1)'),
      size: 8,
    });

    deliveriesRepository.findByIdWithAssignment.mockResolvedValue(delivery);
    storageRepository.create.mockReturnValue(saved);
    storageRepository.save.mockResolvedValue(saved);

    const result = await service.upload(
      {
        deliveryId: delivery.id,
        logicalName: 'main.py',
        logicalPath: 'src/main.py',
        contentType: 'text/x-python',
        hash: 'abc123',
      },
      file,
      student,
    );

    expect(storageRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ sizeBytes: file.size }),
    );
    expect(result.sizeBytes).toBe(file.size);
  });

  it('debe rechazar upload por tamaño mayor a 50MB', async () => {
    const file = buildUploadedStorageFile({
      buffer: Buffer.alloc(1),
      size: 50 * 1024 * 1024 + 1,
    });

    await expect(
      service.upload(
        {
          deliveryId: '06bf45ea-4b34-4f8b-88cb-a7bf7d09a34b',
          logicalName: 'main.py',
          logicalPath: 'src/main.py',
          contentType: 'text/x-python',
          sizeBytes: file.size,
          hash: 'abc123',
        },
        file,
        buildActor(UserRole.STUDENT),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('debe rechazar upload con extensión no permitida', async () => {
    const file = buildUploadedStorageFile();

    await expect(
      service.upload(
        {
          deliveryId: '06bf45ea-4b34-4f8b-88cb-a7bf7d09a34b',
          logicalName: 'malware.exe',
          logicalPath: 'bin/malware.exe',
          contentType: 'application/octet-stream',
          sizeBytes: 1,
          hash: 'abc123',
        },
        file,
        buildActor(UserRole.STUDENT),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('debe rechazar upload con ruta absoluta o traversal', async () => {
    const file = buildUploadedStorageFile();

    await expect(
      service.upload(
        {
          deliveryId: '06bf45ea-4b34-4f8b-88cb-a7bf7d09a34b',
          logicalName: 'main.py',
          logicalPath: 'C:\\repo\\main.py',
          contentType: 'text/x-python',
          sizeBytes: 1,
          hash: 'abc123',
        },
        file,
        buildActor(UserRole.STUDENT),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('debe rechazar upload de student sobre entrega ajena', async () => {
    const student = buildActor(
      UserRole.STUDENT,
      '2e141a4d-e163-43f8-87f8-75afee5e2f85',
    );
    const otherDelivery = buildDelivery({
      authorId: 'c17c421a-14cb-4a9c-a64a-62395cc542f4',
    });
    const file = buildUploadedStorageFile();
    deliveriesRepository.findByIdWithAssignment.mockResolvedValue(
      otherDelivery,
    );

    await expect(
      service.upload(
        {
          deliveryId: otherDelivery.id,
          logicalName: 'main.py',
          logicalPath: 'src/main.py',
          contentType: 'text/x-python',
          sizeBytes: 1,
          hash: 'abc123',
        },
        file,
        student,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('debe traducir colisión de ruta lógica a ConflictException', async () => {
    const student = buildActor(UserRole.STUDENT, 'student-1');
    const delivery = buildDelivery({ authorId: student.userId });
    const file = buildUploadedStorageFile({
      buffer: Buffer.from('print(1)'),
      size: 8,
    });

    deliveriesRepository.findByIdWithAssignment.mockResolvedValue(delivery);
    storageRepository.create.mockReturnValue(
      buildStorageObject({ uploaderId: student.userId }),
    );
    storageRepository.save.mockRejectedValue(
      Object.assign(
        new QueryFailedError('INSERT INTO storage_objects', [], new Error()),
        {
          driverError: { code: '23505' },
        },
      ),
    );

    await expect(
      service.upload(
        {
          deliveryId: delivery.id,
          logicalName: 'main.py',
          logicalPath: 'src/main.py',
          contentType: 'text/x-python',
          sizeBytes: 8,
          hash: 'abc123',
        },
        file,
        student,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('debe generar signed URL con TTL configurado', async () => {
    const admin = buildActor(UserRole.ADMIN, 'admin-1');
    const storageObject = buildStorageObject();
    storageRepository.findByIdWithRelations.mockResolvedValue(storageObject);
    deliveriesRepository.findByIdWithAssignment.mockResolvedValue(
      buildDelivery(),
    );
    minioStorageService.createDownloadSignedUrl.mockResolvedValue(
      'https://minio.local/signed-url',
    );

    const result = await service.createDownloadUrl(storageObject.id, admin);

    expect(minioStorageService.createDownloadSignedUrl).toHaveBeenCalledWith(
      storageObject.bucket,
      storageObject.objectKey,
    );
    expect(result.downloadUrl).toContain('signed-url');
    expect(result.expiresAt).toBeDefined();
  });

  it('debe aplicar soft delete y restaurar objeto si existe en MinIO', async () => {
    const admin = buildActor(UserRole.ADMIN);
    const activeObject = buildStorageObject();
    const deletedObject = buildStorageObject({
      deletedAt: new Date('2026-03-10T00:00:00.000Z'),
    });
    const restoredObject = buildStorageObject({
      deletedAt: undefined,
    });

    storageRepository.findByIdWithRelations
      .mockResolvedValueOnce(activeObject)
      .mockResolvedValueOnce(deletedObject)
      .mockResolvedValueOnce(restoredObject);
    storageRepository.softRemove.mockResolvedValue(deletedObject);
    storageRepository.recover.mockResolvedValue(restoredObject);
    deliveriesRepository.findByIdWithAssignment.mockResolvedValue(
      buildDelivery(),
    );
    minioStorageService.objectExists.mockResolvedValue(true);

    const removeResult = await service.remove(activeObject.id, admin);
    const restoreResult = await service.restore(activeObject.id, admin);

    expect(removeResult.message).toContain('eliminado');
    expect(storageRepository.recover).toHaveBeenCalledWith(deletedObject);
    expect(restoreResult.id).toBe(restoredObject.id);
  });

  it('debe purgar físicamente solo como ADMIN', async () => {
    const admin = buildActor(UserRole.ADMIN);
    const object = buildStorageObject();
    storageRepository.findByIdWithRelations.mockResolvedValue(object);
    deliveriesRepository.findByIdWithAssignment.mockResolvedValue(
      buildDelivery(),
    );

    const result = await service.purge(object.id, admin);

    expect(minioStorageService.deleteObject).toHaveBeenCalledWith(
      object.bucket,
      object.objectKey,
    );
    expect(storageRepository.deleteById).toHaveBeenCalledWith(object.id);
    expect(result.message).toContain('purgado');
  });

  it('debe rechazar purga si no es ADMIN', async () => {
    const teacher = buildActor(UserRole.TEACHER);

    await expect(
      service.purge('b8efef4b-a77d-41cf-9f83-ae2046b0df4a', teacher),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('debe fallar restore si el objeto físico no existe', async () => {
    const admin = buildActor(UserRole.ADMIN);
    const deletedObject = buildStorageObject({
      deletedAt: new Date('2026-03-10T00:00:00.000Z'),
    });
    storageRepository.findByIdWithRelations.mockResolvedValue(deletedObject);
    deliveriesRepository.findByIdWithAssignment.mockResolvedValue(
      buildDelivery(),
    );
    minioStorageService.objectExists.mockResolvedValue(false);

    await expect(
      service.restore(deletedObject.id, admin),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('debe subir la suite docente de un proyecto gestionado por el profesor', async () => {
    const teacher = buildActor(
      UserRole.TEACHER,
      '22222222-2222-2222-2222-222222222222',
    );
    const project = buildProject({ creatorId: teacher.userId });
    const saved = buildStorageObject({
      projectId: project.id,
      deliveryId: null,
      logicalName: 'teacher-suite.zip',
      logicalPath: 'teacher-suite.zip',
      contentType: 'application/zip',
    });

    projectsRepository.findById.mockResolvedValue(project);
    storageRepository.findActiveTeacherTestSuite.mockResolvedValue(null);
    storageRepository.create.mockReturnValue(saved);
    storageRepository.save.mockResolvedValue(saved);

    const result = await service.uploadProjectTestSuite(
      project.id,
      buildUploadedStorageFile({
        size: 20,
        originalname: 'teacher-suite.zip',
        mimetype: 'application/zip',
      }),
      teacher,
    );

    expect(minioStorageService.putObject).toHaveBeenCalled();
    expect(result.projectId).toBe(project.id);
  });
});
