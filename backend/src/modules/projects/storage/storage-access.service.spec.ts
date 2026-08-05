import { ForbiddenException } from '@nestjs/common';
import {
  buildActor,
  buildDelivery,
  buildStorageObject,
} from '../../../test-support/domain-builders';
import { UserRole } from '../../users/entities/user.entity';
import type { IDeliveryRepository } from '../domain/repositories/delivery.repository.interface';
import type { IProjectRepository } from '../domain/repositories/project.repository.interface';
import type { IStorageObjectRepository } from '../domain/repositories/storage-object.repository.interface';
import { StorageAccessService } from './storage-access.service';

describe('StorageAccessService', () => {
  let service: StorageAccessService;
  const storageRepository = {
    findByIdWithRelations: jest.fn(),
  };
  const deliveriesRepository = {
    findByIdWithAssignment: jest.fn(),
  };
  const projectsRepository = {
    findById: jest.fn(),
    isTeacherAssignedToProject: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StorageAccessService(
      storageRepository as unknown as IStorageObjectRepository,
      deliveriesRepository as unknown as IDeliveryRepository,
      projectsRepository as unknown as IProjectRepository,
    );
  });

  it('permite a un student acceder a su artefacto de entrega', async () => {
    const actor = buildActor(UserRole.STUDENT, 'student-1');
    const delivery = buildDelivery({ authorId: actor.userId });
    const storageObject = buildStorageObject({ deliveryId: delivery.id });
    storageRepository.findByIdWithRelations.mockResolvedValue(storageObject);
    deliveriesRepository.findByIdWithAssignment.mockResolvedValue(delivery);

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
    storageRepository.findByIdWithRelations.mockResolvedValue(storageObject);
    deliveriesRepository.findByIdWithAssignment.mockResolvedValue(delivery);

    await expect(
      service.findStorageObjectWithAccess(storageObject.id, actor),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
/**
 * Pruebas del alcance de acceso a objetos de almacenamiento según actor y contexto.
 */
