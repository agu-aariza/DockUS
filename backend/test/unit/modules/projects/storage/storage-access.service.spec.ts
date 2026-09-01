import { ForbiddenException } from '@nestjs/common';
import {
  buildActor,
  buildDelivery,
  buildProject,
  buildStorageObject,
} from '@test/support/domain-builders';
import { UserRole } from '@app/modules/users/entities/user.entity';
import type { IDeliveryRepository } from '@app/modules/projects/domain/repositories/delivery.repository.interface';
import type { IStorageObjectRepository } from '@app/modules/projects/domain/repositories/storage-object.repository.interface';
import type { ProjectAccessService } from '@app/modules/projects/project-access.service';
import { StorageAccessService } from '@app/modules/projects/storage/storage-access.service';

describe('StorageAccessService', () => {
  let service: StorageAccessService;
  const storageRepository = {
    findByIdWithRelations: jest.fn(),
  };
  const deliveriesRepository = {
    findByIdWithAssignment: jest.fn(),
  };
  const projectAccessService = {
    findProjectOrThrow: jest.fn(),
    assertCanAccessProject: jest.fn(),
    assertCanManageProject: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StorageAccessService(
      storageRepository as unknown as IStorageObjectRepository,
      deliveriesRepository as unknown as IDeliveryRepository,
      projectAccessService as unknown as ProjectAccessService,
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

  it('permite a un teacher acceder a un artefacto de proyecto asignado', async () => {
    const actor = buildActor(UserRole.TEACHER, 'teacher-1');
    const project = buildProject({ id: 'project-1' });
    const storageObject = buildStorageObject({
      projectId: project.id,
      deliveryId: null,
    });
    storageRepository.findByIdWithRelations.mockResolvedValue(storageObject);
    projectAccessService.findProjectOrThrow.mockResolvedValue(project);
    projectAccessService.assertCanAccessProject.mockResolvedValue(project);

    const result = await service.findStorageObjectWithAccess(
      storageObject.id,
      actor,
    );

    expect(result.id).toBe(storageObject.id);
    expect(projectAccessService.assertCanAccessProject).toHaveBeenCalledWith(
      project.id,
      actor,
    );
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
