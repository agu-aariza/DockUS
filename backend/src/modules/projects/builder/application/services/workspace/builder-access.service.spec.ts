import { ForbiddenException } from '@nestjs/common';
import { BuilderAccessService } from './builder-access.service';
import { UserRole } from '../../../../../users/entities/user.entity';
import { ProjectStatus } from '../../../../entities/project.entity';
import type { Delivery } from '../../../../deliveries/entities/delivery.entity';
import type { AuthenticatedUser } from '../../../../../auth/interfaces/authenticated-user.interface';

/** ARQ-001: el alumno debe poder lanzar la evaluacion de su propia entrega. */
describe('BuilderAccessService — assertCanTriggerDelivery', () => {
  let service: BuilderAccessService;

  const deliveriesRepository = { findOne: jest.fn() };
  const projectsRepository = { createQueryBuilder: jest.fn() };

  const buildDelivery = (
    overrides: Partial<{
      authorId: string;
      revokedAt: Date | null;
      projectStatus: ProjectStatus;
    }> = {},
  ): Delivery =>
    ({
      id: 'delivery-1',
      authorId: overrides.authorId ?? 'student-1',
      assignment: {
        id: 'assignment-1',
        revokedAt: overrides.revokedAt ?? null,
        project: {
          id: 'project-1',
          status: overrides.projectStatus ?? ProjectStatus.ACTIVE,
        },
      },
    }) as unknown as Delivery;

  const buildActor = (
    role: UserRole,
    userId = 'student-1',
  ): AuthenticatedUser => ({ userId, role }) as AuthenticatedUser;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BuilderAccessService(
      deliveriesRepository as never,
      projectsRepository as never,
    );
  });

  it('permite al alumno dueño de la entrega con asignacion viva y proyecto activo', async () => {
    const delivery = buildDelivery();
    await expect(
      service.assertCanTriggerDelivery(delivery, buildActor(UserRole.STUDENT)),
    ).resolves.toBeUndefined();
  });

  it('rechaza al alumno sobre una entrega ajena', async () => {
    const delivery = buildDelivery({ authorId: 'other-student' });
    await expect(
      service.assertCanTriggerDelivery(delivery, buildActor(UserRole.STUDENT)),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rechaza al alumno cuando la asignacion esta revocada', async () => {
    const delivery = buildDelivery({ revokedAt: new Date() });
    await expect(
      service.assertCanTriggerDelivery(delivery, buildActor(UserRole.STUDENT)),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rechaza al alumno cuando el proyecto no esta activo', async () => {
    const delivery = buildDelivery({ projectStatus: ProjectStatus.ARCHIVED });
    await expect(
      service.assertCanTriggerDelivery(delivery, buildActor(UserRole.STUDENT)),
    ).rejects.toThrow(ForbiddenException);
  });

  it('permite a ADMIN sin comprobar asignacion de docente', async () => {
    const delivery = buildDelivery();
    await expect(
      service.assertCanTriggerDelivery(
        delivery,
        buildActor(UserRole.ADMIN, 'admin-1'),
      ),
    ).resolves.toBeUndefined();
  });

  it('permite a TEACHER asignado al proyecto (misma politica que assertCanManageDelivery)', async () => {
    const delivery = buildDelivery();
    const queryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getExists: jest.fn().mockResolvedValue(true),
    };
    projectsRepository.createQueryBuilder.mockReturnValue(queryBuilder);

    await expect(
      service.assertCanTriggerDelivery(
        delivery,
        buildActor(UserRole.TEACHER, 'teacher-1'),
      ),
    ).resolves.toBeUndefined();
  });

  it('rechaza a TEACHER no asignado al proyecto', async () => {
    const delivery = buildDelivery();
    const queryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getExists: jest.fn().mockResolvedValue(false),
    };
    projectsRepository.createQueryBuilder.mockReturnValue(queryBuilder);

    await expect(
      service.assertCanTriggerDelivery(
        delivery,
        buildActor(UserRole.TEACHER, 'teacher-2'),
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});
