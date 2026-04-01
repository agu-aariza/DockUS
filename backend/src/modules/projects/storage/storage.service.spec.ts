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
import { QueryFailedError, Repository } from 'typeorm';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../../users/entities/user.entity';
import {
  Delivery,
  DeliveryStatus,
} from '../deliveries/entities/delivery.entity';
import { MinioStorageService } from '../../../shared/infrastructure/storage/minio-storage.service';
import { StorageObject } from './entities/storage-object.entity';
import { UploadedStorageFile } from './interfaces/uploaded-storage-file.interface';
import { StorageService } from './storage.service';

const buildActor = (
  role: UserRole,
  userId = 'd9428888-122b-11e1-b85c-61cd3cbb3210',
): AuthenticatedUser => ({
  userId,
  email: `${role.toLowerCase()}@dockus.com`,
  role,
});

const buildDelivery = (overrides: Partial<Delivery> = {}): Delivery => ({
  id: '06bf45ea-4b34-4f8b-88cb-a7bf7d09a34b',
  projectId: '5a6f2626-c78c-4842-b180-f1ca0a3f2d53',
  project: undefined as unknown as Delivery['project'],
  authorId: 'd9428888-122b-11e1-b85c-61cd3cbb3210',
  version: 2,
  status: DeliveryStatus.SUBMITTED,
  notes: null,
  createdAt: new Date('2026-03-09T00:00:00.000Z'),
  updatedAt: new Date('2026-03-09T00:00:00.000Z'),
  deletedAt: undefined as unknown as Date,
  ...overrides,
});

const buildStorageObject = (
  overrides: Partial<StorageObject> = {},
): StorageObject => ({
  id: 'b8efef4b-a77d-41cf-9f83-ae2046b0df4a',
  deliveryId: '06bf45ea-4b34-4f8b-88cb-a7bf7d09a34b',
  delivery: undefined as unknown as StorageObject['delivery'],
  logicalName: 'main.py',
  logicalPath: 'src/main.py',
  contentType: 'text/x-python',
  sizeBytes: 10,
  hash: 'abc123',
  bucket: 'dockus-storage',
  objectKey: 'deliveries/06bf45ea-4b34-4f8b-88cb-a7bf7d09a34b/v2/main.py',
  uploaderId: 'd9428888-122b-11e1-b85c-61cd3cbb3210',
  createdAt: new Date('2026-03-09T00:00:00.000Z'),
  updatedAt: new Date('2026-03-09T00:00:00.000Z'),
  deletedAt: undefined as unknown as Date,
  ...overrides,
});

const buildUploadedFile = (
  overrides: Partial<UploadedStorageFile> = {},
): UploadedStorageFile => ({
  buffer: Buffer.alloc(1),
  size: 1,
  ...overrides,
});

describe('StorageService', () => {
  let service: StorageService;

  const queryBuilder = {
    andWhere: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
  };

  const storageRepository = {
    create: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    delete: jest.fn(),
    findOne: jest.fn(),
    recover: jest.fn(),
    save: jest.fn(),
    softRemove: jest.fn(),
  };

  const deliveriesRepository = {
    findOne: jest.fn(),
  };

  const minioStorageService = {
    createDownloadSignedUrl: jest.fn(),
    deleteObject: jest.fn(),
    getBucketName: jest.fn(),
    getSignedUrlTtlSeconds: jest.fn(),
    objectExists: jest.fn(),
    putObject: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    queryBuilder.andWhere.mockReturnThis();
    queryBuilder.leftJoin.mockReturnThis();
    queryBuilder.orderBy.mockReturnThis();
    queryBuilder.skip.mockReturnThis();
    queryBuilder.take.mockReturnThis();

    minioStorageService.getBucketName.mockReturnValue('dockus-storage');
    minioStorageService.getSignedUrlTtlSeconds.mockReturnValue(600);
    minioStorageService.putObject.mockResolvedValue(undefined);
    minioStorageService.deleteObject.mockResolvedValue(undefined);
    minioStorageService.objectExists.mockResolvedValue(true);

    service = new StorageService(
      storageRepository as unknown as Repository<StorageObject>,
      deliveriesRepository as unknown as Repository<Delivery>,
      minioStorageService as unknown as MinioStorageService,
    );
  });

  it('debe subir objeto y persistir metadata cuando todo es valido', async () => {
    const student = buildActor(UserRole.STUDENT);
    const delivery = buildDelivery({ authorId: student.userId });
    const saved = buildStorageObject({ uploaderId: student.userId });
    const file = buildUploadedFile({
      buffer: Buffer.from('print(1)'),
      size: 8,
    });

    deliveriesRepository.findOne.mockResolvedValue(delivery);
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
      key: `deliveries/${delivery.id}/v${delivery.version}/main.py`,
      body: file.buffer,
      contentType: 'text/x-python',
    });
    expect(storageRepository.save).toHaveBeenCalled();
    expect(storageRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ sizeBytes: file.size }),
    );
    expect(result.deliveryId).toBe(delivery.id);
  });

  it('debe permitir upload sin sizeBytes declarado y usar tamano real', async () => {
    const student = buildActor(UserRole.STUDENT);
    const delivery = buildDelivery({ authorId: student.userId });
    const saved = buildStorageObject({
      uploaderId: student.userId,
      sizeBytes: 8,
    });
    const file = buildUploadedFile({
      buffer: Buffer.from('print(1)'),
      size: 8,
    });

    deliveriesRepository.findOne.mockResolvedValue(delivery);
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
    const file = buildUploadedFile({
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
    const file = buildUploadedFile();

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
    const file = buildUploadedFile();

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
    const file = buildUploadedFile();
    deliveriesRepository.findOne.mockResolvedValue(otherDelivery);

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

  it('debe generar signed URL con TTL configurado', async () => {
    const student = buildActor(UserRole.STUDENT);
    const storageObject = buildStorageObject();
    deliveriesRepository.findOne.mockResolvedValue(
      buildDelivery({ authorId: student.userId }),
    );
    storageRepository.findOne.mockResolvedValue(storageObject);
    minioStorageService.createDownloadSignedUrl.mockResolvedValue(
      'https://minio.local/signed-url',
    );

    const result = await service.createDownloadUrl(storageObject.id, student);

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
      deletedAt: undefined as unknown as Date,
    });

    storageRepository.findOne
      .mockResolvedValueOnce(activeObject)
      .mockResolvedValueOnce(deletedObject)
      .mockResolvedValueOnce(restoredObject);
    storageRepository.softRemove.mockResolvedValue(deletedObject);
    storageRepository.recover.mockResolvedValue(restoredObject);
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
    storageRepository.findOne.mockResolvedValue(object);

    const result = await service.purge(object.id, admin);

    expect(minioStorageService.deleteObject).toHaveBeenCalledWith(
      object.bucket,
      object.objectKey,
    );
    expect(storageRepository.delete).toHaveBeenCalledWith({ id: object.id });
    expect(result.message).toContain('purgado');
  });

  it('debe limitar listado de STUDENT a entregas de su autoría', async () => {
    const student = buildActor(UserRole.STUDENT);
    queryBuilder.getManyAndCount.mockResolvedValue([[buildStorageObject()], 1]);

    await service.findAll(
      {
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'DESC',
      },
      student,
    );

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'delivery.authorId = :requestUserId',
      { requestUserId: student.userId },
    );
  });

  it('debe traducir colisión de ruta lógica a ConflictException', async () => {
    const student = buildActor(UserRole.STUDENT);
    const delivery = buildDelivery({ authorId: student.userId });
    const file = buildUploadedFile({
      buffer: Buffer.from('print(1)'),
      size: 8,
    });
    const uniqueViolationDriverError = Object.assign(
      new Error('duplicate key value violates unique constraint'),
      { code: '23505' },
    );
    const uniqueViolation = new QueryFailedError(
      'INSERT INTO storage_objects',
      [],
      uniqueViolationDriverError,
    );

    deliveriesRepository.findOne.mockResolvedValue(delivery);
    storageRepository.create.mockReturnValue(buildStorageObject());
    storageRepository.save.mockRejectedValue(uniqueViolation);

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
    storageRepository.findOne.mockResolvedValue(deletedObject);
    minioStorageService.objectExists.mockResolvedValue(false);

    await expect(
      service.restore(deletedObject.id, admin),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
