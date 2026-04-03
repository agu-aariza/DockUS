import {
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { MinioStorageService } from '../../../shared/infrastructure/storage/minio-storage.service';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../../users/entities/user.entity';
import { Delivery } from '../deliveries/entities/delivery.entity';
import { StorageObject } from '../storage/entities/storage-object.entity';
import { BuilderService } from './builder.service';

const buildActor = (
  role: UserRole,
  userId = 'd9428888-122b-11e1-b85c-61cd3cbb3210',
): AuthenticatedUser => ({
  userId,
  email: `${role.toLowerCase()}@dockus.test`,
  role,
});

const buildDelivery = (overrides: Partial<Delivery> = {}): Delivery => ({
  id: '06bf45ea-4b34-4f8b-88cb-a7bf7d09a34b',
  projectId: '5a6f2626-c78c-4842-b180-f1ca0a3f2d53',
  project: undefined as unknown as Delivery['project'],
  authorId: 'd9428888-122b-11e1-b85c-61cd3cbb3210',
  version: 1,
  status: undefined as unknown as Delivery['status'],
  notes: null,
  createdAt: new Date('2026-04-02T10:00:00.000Z'),
  updatedAt: new Date('2026-04-02T10:00:00.000Z'),
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
  sizeBytes: 20,
  hash: 'abc123',
  bucket: 'dockus-storage',
  objectKey: 'deliveries/06bf45ea-4b34-4f8b-88cb-a7bf7d09a34b/v1/main.py',
  uploaderId: 'd9428888-122b-11e1-b85c-61cd3cbb3210',
  createdAt: new Date('2026-04-02T10:00:00.000Z'),
  updatedAt: new Date('2026-04-02T10:00:00.000Z'),
  deletedAt: undefined as unknown as Date,
  ...overrides,
});

describe('BuilderService', () => {
  let service: BuilderService;

  const deliveriesRepository = {
    findOne: jest.fn(),
  };

  const storageRepository = {
    find: jest.fn(),
  };

  const minioStorageService = {
    getObjectBuffer: jest.fn(),
  };

  const configService = {
    get: jest.fn((key: string, defaultValue: unknown) => {
      const values: Record<string, unknown> = {
        BUILDER_OLLAMA_TIMEOUT_MS: 120000,
        BUILDER_DOCKER_BUILD_TIMEOUT_MS: 300000,
        BUILDER_CLEANUP_IMAGES: true,
        BUILDER_DEFAULT_PYTHON_VERSION: '3.11',
        BUILDER_MAX_EXTRACTED_FILES: 1500,
        BUILDER_MAX_EXTRACTED_BYTES: 104857600,
        BUILDER_PROMPT_MAX_CHARS: 180000,
      };

      return key in values ? values[key] : defaultValue;
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BuilderService(
      deliveriesRepository as unknown as Repository<Delivery>,
      storageRepository as unknown as Repository<StorageObject>,
      minioStorageService as unknown as MinioStorageService,
      configService as never,
    );
  });

  it('bloquea acceso a estudiantes para entregas ajenas', async () => {
    const actor = buildActor(
      UserRole.STUDENT,
      '2e141a4d-e163-43f8-87f8-75afee5e2f85',
    );
    deliveriesRepository.findOne.mockResolvedValue(
      buildDelivery({
        authorId: 'c17c421a-14cb-4a9c-a64a-62395cc542f4',
      }),
    );

    await expect(
      service.runDeliveryBuilder('06bf45ea-4b34-4f8b-88cb-a7bf7d09a34b', actor),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(storageRepository.find).not.toHaveBeenCalled();
  });

  it('corta pipeline por rutas absolutas antes de llamar al modelo', async () => {
    const actor = buildActor(UserRole.STUDENT);
    deliveriesRepository.findOne.mockResolvedValue(buildDelivery());
    storageRepository.find.mockResolvedValue([buildStorageObject()]);
    minioStorageService.getObjectBuffer.mockResolvedValue(
      Buffer.from('LOCAL_PATH = "/home/jose/proyecto/main.py"\nprint("ok")\n'),
    );

    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() =>
        Promise.reject(new Error('No deberia llamarse fetch en este test.')),
      );

    await expect(
      service.runDeliveryBuilder('06bf45ea-4b34-4f8b-88cb-a7bf7d09a34b', actor),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);

    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockRestore();
  });
});
