/**
 * @fileoverview Pruebas unitarias del servicio de comandos de entregas.
 *
 * Contexto:
 * - Valida creación, restauración y restricciones clave del dominio.
 * - Mantiene las pruebas alineadas con el modelo actual basado en asignaciones.
 *
 * @module DeliveriesCommandServiceSpec
 */

import { ConflictException, ForbiddenException } from '@nestjs/common';
import {
  buildActor,
  buildAssignment,
  buildDelivery,
  buildProject,
} from '@test/support/domain-builders';
import { UserRole } from '@app/modules/users/entities/user.entity';
import type { IDeliveryRepository } from '@app/modules/projects/domain/repositories/delivery.repository.interface';
import type { IProjectRepository } from '@app/modules/projects/domain/repositories/project.repository.interface';
import type { IProjectAssignmentRepository } from '@app/modules/projects/domain/repositories/project-assignment.repository.interface';
import { DeliveryStatus } from '@app/modules/projects/deliveries/entities/delivery.entity';
import { DeliveriesCommandService } from '@app/modules/projects/deliveries/deliveries-command.service';
import { DeliveriesQueryService } from '@app/modules/projects/deliveries/deliveries-query.service';

describe('DeliveriesCommandService', () => {
  let service: DeliveriesCommandService;

  const deliveriesRepository = {
    create: jest.fn(),
    save: jest.fn(),
    recover: jest.fn(),
    findOne: jest.fn(),
  };

  const assignmentsRepository = {
    findByIdWithProjectAndStudent: jest.fn(),
  };

  const projectsRepository = {
    isTeacherAssignedToProject: jest.fn(),
  };

  const deliveriesQueryService = {
    findEntityById: jest.fn(),
    toResponse: jest.fn(),
    resolveCurrentMaxVersion: jest.fn(),
  } as unknown as jest.Mocked<DeliveriesQueryService>;

  const deliveryStatusService = {
    updateStatusInternal: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    projectsRepository.isTeacherAssignedToProject.mockResolvedValue(false);

    service = new DeliveriesCommandService(
      deliveriesRepository as unknown as IDeliveryRepository,
      assignmentsRepository as unknown as IProjectAssignmentRepository,
      projectsRepository as unknown as IProjectRepository,
      {} as any, // storageService mock
      deliveriesQueryService,
      deliveryStatusService as any,
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

    assignmentsRepository.findByIdWithProjectAndStudent.mockResolvedValue(
      assignment,
    );
    deliveriesRepository.create.mockReturnValue(created);
    deliveriesRepository.save.mockResolvedValue(created);
    deliveriesQueryService.resolveCurrentMaxVersion.mockResolvedValue(0);
    deliveriesQueryService.findEntityById.mockResolvedValue(created);
    deliveriesQueryService.toResponse.mockResolvedValue({
      id: created.id,
      assignmentId: assignment.id,
      projectId: assignment.projectId,
      studentEmail: 'student@educodeai.test',
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
      studentEmail: 'student@educodeai.test',
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

    assignmentsRepository.findByIdWithProjectAndStudent.mockResolvedValue(
      assignment,
    );
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

  describe('updateGrading (co-docentes, no solo el creador del proyecto)', () => {
    it('permite calificar a un docente asignado al proyecto aunque no sea el creador', async () => {
      const teacher = buildActor(UserRole.TEACHER, 'teacher-2');
      const project = buildProject({ creatorId: 'teacher-1' });
      const assignment = buildAssignment({ project });
      const delivery = buildDelivery({ assignment });

      deliveriesQueryService.findEntityById.mockResolvedValue(delivery);
      projectsRepository.isTeacherAssignedToProject.mockResolvedValue(true);
      deliveriesRepository.save.mockResolvedValue(delivery);
      deliveriesQueryService.toResponse.mockResolvedValue({
        id: delivery.id,
      } as any);

      const result = await service.updateGrading(
        delivery.id,
        { grade: 8 },
        teacher,
      );

      expect(
        projectsRepository.isTeacherAssignedToProject,
      ).toHaveBeenCalledWith(project.id, 'teacher-2');
      expect(deliveriesRepository.save).toHaveBeenCalled();
      expect(result.id).toBe(delivery.id);
    });

    it('registra si la propuesta IA se adopta con modificaciones', async () => {
      const teacher = buildActor(UserRole.TEACHER, 'teacher-2');
      const project = buildProject({ creatorId: 'teacher-1' });
      const assignment = buildAssignment({ project });
      const delivery = buildDelivery({ assignment });
      const log = jest
        .spyOn(
          (service as unknown as { logger: { log: (value: string) => void } })
            .logger,
          'log',
        )
        .mockImplementation(() => undefined);

      deliveriesQueryService.findEntityById.mockResolvedValue(delivery);
      projectsRepository.isTeacherAssignedToProject.mockResolvedValue(true);
      deliveriesRepository.save.mockResolvedValue(delivery);
      deliveriesQueryService.toResponse.mockResolvedValue({
        id: delivery.id,
      } as any);

      await service.updateGrading(
        delivery.id,
        { grade: 7, aiProposedGrade: 8 },
        teacher,
      );

      expect(log).toHaveBeenCalledWith(
        expect.stringContaining('"modifiedAfterAdoption":true'),
      );
      expect(log).toHaveBeenCalledWith(
        expect.stringContaining('"adoptedWithoutModification":false'),
      );
    });

    it('rechaza calificar a un docente no asignado al proyecto', async () => {
      const teacher = buildActor(UserRole.TEACHER, 'teacher-3');
      const project = buildProject({ creatorId: 'teacher-1' });
      const assignment = buildAssignment({ project });
      const delivery = buildDelivery({ assignment });

      deliveriesQueryService.findEntityById.mockResolvedValue(delivery);
      projectsRepository.isTeacherAssignedToProject.mockResolvedValue(false);

      await expect(
        service.updateGrading(delivery.id, { grade: 8 }, teacher),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(deliveriesRepository.save).not.toHaveBeenCalled();
    });
  });
});
