import { ForbiddenException } from '@nestjs/common';
import { Repository } from 'typeorm';
import {
  buildActor,
  buildDelivery,
  buildStorageObject,
} from '../../../test-support/domain-builders';
import { UserRole } from '../../users/entities/user.entity';
import { Delivery } from '../deliveries/entities/delivery.entity';
import { Project } from '../entities/project.entity';
import { StorageObject } from './entities/storage-object.entity';
import { StorageAccessService } from './storage-access.service';

describe('StorageAccessService', () => {
  let service: StorageAccessService;
  const storageRepository = {
    findOne: jest.fn(),
  };
  const deliveriesRepository = {
    findOne: jest.fn(),
  };
  const projectsRepository = {
    findOne: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StorageAccessService(
      storageRepository as unknown as Repository<StorageObject>,
      deliveriesRepository as unknown as Repository<Delivery>,
      projectsRepository as unknown as Repository<Project>,
    );
  });

  it('permite a un student acceder a su artefacto de entrega', async () => {
    const actor = buildActor(UserRole.STUDENT, 'student-1');
    const delivery = buildDelivery({ authorId: actor.userId });
    const storageObject = buildStorageObject({ deliveryId: delivery.id });
    storageRepository.findOne.mockResolvedValue(storageObject);
    deliveriesRepository.findOne.mockResolvedValue(delivery);

    const result = await service.findStorageObjectWithAccess(
      storageObject.id,
      actor,
    );

    expect(result.id).toBe(storageObject.id);
  });

  it('rechaza a un student sobre una entrega ajena', async () => {
    const actor = buildActor(UserRole.STUDENT, 'student-1');
    const delivery = buildDelivery({ authorId: 'student-2' });
    const storageObject = buildStorageObject({ deliveryId: delivery.id });
    storageRepository.findOne.mockResolvedValue(storageObject);
    deliveriesRepository.findOne.mockResolvedValue(delivery);

    await expect(
      service.findStorageObjectWithAccess(storageObject.id, actor),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
