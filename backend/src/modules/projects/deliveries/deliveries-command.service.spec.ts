/**
 * @fileoverview Pruebas unitarias del servicio de comandos de entregas.
 *
 * Contexto:
 * - Valida creación, restauración y restricciones clave del dominio.
 * - Mantiene las pruebas alineadas con el modelo actual basado en asignaciones.
 *
 * @module DeliveriesCommandServiceSpec
 */

import { ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import {
  buildActor,
  buildAssignment,
  buildDelivery,
  buildProject,
} from '../../../test-support/domain-builders';
import { UserRole } from '../../users/entities/user.entity';
import { ProjectAssignment } from '../assignments/entities/project-assignment.entity';
import { Delivery, DeliveryStatus } from './entities/delivery.entity';
import { DeliveriesCommandService } from './deliveries-command.service';
import { DeliveriesQueryService } from './deliveries-query.service';

describe('DeliveriesCommandService', () => {
  let service: DeliveriesCommandService;

  const deliveriesRepository = {
    create: jest.fn(),
    save: jest.fn(),
    recover: jest.fn(),
    findOne: jest.fn(),
  };

  const assignmentsRepository = {
    findOne: jest.fn(),
  };

  const deliveriesQueryService = {
    findEntityById: jest.fn(),
    toResponse: jest.fn(),
    resolveCurrentMaxVersion: jest.fn(),
  } as unknown as jest.Mocked<DeliveriesQueryService>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DeliveriesCommandService(
      deliveriesRepository as unknown as Repository<Delivery>,
      assignmentsRepository as unknown as Repository<ProjectAssignment>,
      {} as any, // storageService mock
      deliveriesQueryService,
    );
  });

  it('debe crear entrega cuando la asignación es válida', async () => {
    const actor = buildActor(
      UserRole.STUDENT,
      '44444444-4444-4444-4444-444444444444',
    );
    const assignment = buildAssignment();
    const created = buildDelivery({
      assignmentId: assignment.id,
      assignment,
      authorId: actor.userId,
      notes: 'Entrega base',
    });

    assignmentsRepository.findOne.mockResolvedValue(assignment);
    deliveriesRepository.create.mockReturnValue(created);
    deliveriesRepository.save.mockResolvedValue(created);
    deliveriesQueryService.resolveCurrentMaxVersion.mockResolvedValue(0);
    deliveriesQueryService.findEntityById.mockResolvedValue(created);
    deliveriesQueryService.toResponse.mockResolvedValue({
      id: created.id,
      assignmentId: assignment.id,
      projectId: assignment.projectId,
      studentEmail: 'student@dockus.test',
      remainingDeliveries: 1,
    } as any);

    const result = await service.create(
      {
        assignmentId: assignment.id,
        notes: '  Entrega base  ',
      },
      actor,
    );

    expect(deliveriesRepository.create).toHaveBeenCalledWith({
      assignmentId: assignment.id,
      authorId: actor.userId,
      version: 1,
      status: DeliveryStatus.DRAFT,
      notes: 'Entrega base',
      isLate: false,
      grade: null,
      graderNotes: null,
    });
    expect(result).toMatchObject({
      id: created.id,
      assignmentId: assignment.id,
      projectId: assignment.projectId,
      studentEmail: 'student@dockus.test',
      remainingDeliveries: 1,
    });
  });

  it('debe rechazar nuevas entregas cuando se agota el cupo', async () => {
    const actor = buildActor(
      UserRole.STUDENT,
      '44444444-4444-4444-4444-444444444444',
    );
    const assignment = buildAssignment({
      project: buildProject({ maxDeliveriesPerStudent: 1 }),
    });

    assignmentsRepository.findOne.mockResolvedValue(assignment);
    deliveriesQueryService.resolveCurrentMaxVersion.mockResolvedValue(1);

    await expect(
      service.create(
        {
          assignmentId: assignment.id,
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('debe restaurar una entrega eliminada', async () => {
    const actor = buildActor(UserRole.ADMIN, 'admin-1');
    const deleted = buildDelivery({
      deletedAt: new Date('2026-03-08T00:00:00.000Z'),
    });
    const restored = buildDelivery({
      deletedAt: undefined,
    });

    deliveriesQueryService.findEntityById
      .mockResolvedValueOnce(deleted)
      .mockResolvedValueOnce(restored);
    deliveriesRepository.recover.mockResolvedValue(restored);
    deliveriesQueryService.toResponse.mockResolvedValue({
      id: restored.id,
    } as any);

    const result = await service.restore(deleted.id, actor);

    expect(deliveriesRepository.recover).toHaveBeenCalledWith(deleted);
    expect(result.id).toBe(restored.id);
  });
});
