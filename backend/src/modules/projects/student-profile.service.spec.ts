import { NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { User, UserRole, UserStatus } from '../users/entities/user.entity';
import type { IUserRepository } from '../users/domain/repositories/user.repository.interface';
import type { GroupRosterReader } from '../../shared/application/group-roster-reader.port';
import { ProjectAssignment } from './assignments/entities/project-assignment.entity';
import {
  BuildRun,
  BuildRunStatus,
} from './builder/domain/entities/build-run.entity';
import {
  Delivery,
  DeliveryStatus,
} from './deliveries/entities/delivery.entity';
import type { IDeliveryRepository } from './domain/repositories/delivery.repository.interface';
import type { IProjectAssignmentRepository } from './domain/repositories/project-assignment.repository.interface';
import type { IBuildRunRepository } from './builder/domain/repositories/build-run.repository.interface';
import { StudentProfileService } from './student-profile.service';

describe('StudentProfileService', () => {
  const STUDENT_ID = 'student-1';
  const TEACHER_ID = 'teacher-1';

  const student = {
    id: STUDENT_ID,
    firstName: 'Alumno',
    lastName: 'Ariza',
    email: 'alumno1@educodeai.com',
    role: UserRole.STUDENT,
    status: UserStatus.ACTIVE,
  } as User;

  const buildService = (options: {
    assignments?: ProjectAssignment[];
    deliveries?: Delivery[];
    runs?: BuildRun[];
    groups?: Array<{ id: string; name: string; code: string | null }>;
    studentFound?: boolean;
  }) => {
    const usersRepository = {
      findByIdAndRole: jest.fn(async () =>
        options.studentFound === false ? null : student,
      ),
    } as unknown as IUserRepository;

    const assignmentsRepository = {
      findVisibleForStudent: jest.fn(async () => options.assignments ?? []),
    } as unknown as IProjectAssignmentRepository;

    const deliveriesRepository = {
      findByAssignmentIds: jest.fn(async () => options.deliveries ?? []),
    } as unknown as IDeliveryRepository;

    const buildRunsRepository = {
      findScalarSummaryByDeliveryIds: jest.fn(async () => options.runs ?? []),
    } as unknown as IBuildRunRepository;

    const groupRosterReader = {
      listEnrollments: jest.fn(),
      listGroups: jest.fn(),
      listGroupsForStudent: jest.fn(async () => options.groups ?? []),
    } as unknown as jest.Mocked<GroupRosterReader>;

    const service = new StudentProfileService(
      usersRepository,
      assignmentsRepository,
      deliveriesRepository,
      buildRunsRepository,
      groupRosterReader,
    );

    return {
      service,
      assignmentsRepository,
      deliveriesRepository,
      buildRunsRepository,
      groupRosterReader,
    };
  };

  const buildAssignment = (
    overrides: Partial<ProjectAssignment> = {},
  ): ProjectAssignment =>
    ({
      id: 'assignment-1',
      studentId: STUDENT_ID,
      projectId: 'project-1',
      assignedAt: new Date('2026-03-01T10:00:00Z'),
      revokedAt: null,
      sourceGroupIds: [],
      project: {
        id: 'project-1',
        title: '9879',
        status: 'ACTIVE',
        expectedType: 'C_CLI',
        teachers: [
          { id: TEACHER_ID, firstName: 'Ana', lastName: 'Docente' },
          { id: 'teacher-2', firstName: 'Luis', lastName: 'Otro' },
        ],
      },
      ...overrides,
    }) as unknown as ProjectAssignment;

  const buildDelivery = (overrides: Partial<Delivery> = {}): Delivery =>
    ({
      id: 'delivery-1',
      assignmentId: 'assignment-1',
      version: 1,
      status: DeliveryStatus.EVALUATED,
      isLate: false,
      grade: '8.50',
      createdAt: new Date('2026-03-12T09:00:00Z'),
      ...overrides,
    }) as unknown as Delivery;

  const buildRun = (overrides: Partial<BuildRun> = {}): BuildRun =>
    ({
      id: 'run-1',
      deliveryId: 'delivery-1',
      // Lo lanza SIEMPRE un profesor: por eso el expediente no puede contar
      // runs por `triggeredById`.
      triggeredById: TEACHER_ID,
      status: BuildRunStatus.SUCCESS,
      createdAt: new Date('2026-03-12T09:05:00Z'),
      finishedAt: new Date('2026-03-12T09:07:00Z'),
      inputTokens: 1240,
      outputTokens: 850,
      executionCostUsd: '0.004200',
      ...overrides,
    }) as unknown as BuildRun;

  const actor = (role: UserRole, userId = 'actor-1'): AuthenticatedUser => ({
    userId,
    role,
    email: 'actor@educodeai.com',
  });

  it('cuenta los runs a través de las entregas del alumno, no por triggeredById', async () => {
    const { service, buildRunsRepository } = buildService({
      assignments: [buildAssignment()],
      deliveries: [buildDelivery()],
      runs: [
        buildRun(),
        buildRun({ id: 'run-2', status: BuildRunStatus.FAILED }),
      ],
    });

    const profile = await service.getProfile(STUDENT_ID, actor(UserRole.ADMIN));

    // Los runs se resuelven por deliveryId (findScalarSummaryByDeliveryIds);
    // jamás por triggeredById, que es siempre el profesor y devolvería cero.
    expect(
      buildRunsRepository.findScalarSummaryByDeliveryIds,
    ).toHaveBeenCalledWith(['delivery-1']);

    expect(profile.summary.runsCount).toBe(2);
    expect(profile.projects[0].deliveries[0].runs).toHaveLength(2);
  });

  it('resume notas, entregas y coste con los tipos numéricos ya convertidos', async () => {
    const { service } = buildService({
      assignments: [buildAssignment()],
      deliveries: [
        buildDelivery(),
        buildDelivery({
          id: 'delivery-2',
          version: 2,
          status: DeliveryStatus.SUBMITTED,
          grade: null as never,
        }),
      ],
      runs: [buildRun()],
    });

    const profile = await service.getProfile(STUDENT_ID, actor(UserRole.ADMIN));

    expect(profile.summary).toMatchObject({
      projectsCount: 1,
      deliveriesCount: 2,
      runsCount: 1,
      evaluatedCount: 1,
      averageGrade: 8.5,
    });
    // `decimal` de TypeORM llega como string: el contrato promete number.
    expect(profile.projects[0].grade).toBe(8.5);
    expect(profile.projects[0].deliveries[0].runs[0].executionCostUsd).toBe(
      0.0042,
    );
  });

  it('delega el scoping por actor en el puerto (cubierto en detalle por project-assignment-actor-scope.util.spec.ts)', async () => {
    const { service, assignmentsRepository } = buildService({
      assignments: [buildAssignment()],
    });
    const teacher = actor(UserRole.TEACHER, TEACHER_ID);

    await service.getProfile(STUDENT_ID, teacher);

    expect(assignmentsRepository.findVisibleForStudent).toHaveBeenCalledWith(
      STUDENT_ID,
      teacher,
    );
  });

  it('devuelve un expediente vacío sin romper cuando el alumno no ha entregado', async () => {
    const { service, deliveriesRepository, buildRunsRepository } = buildService(
      {
        assignments: [],
        groups: [{ id: 'g1', name: '2º DAW', code: 'DAW-24' }],
      },
    );

    const profile = await service.getProfile(STUDENT_ID, actor(UserRole.ADMIN));

    expect(profile.projects).toEqual([]);
    expect(profile.summary).toEqual({
      projectsCount: 0,
      deliveriesCount: 0,
      runsCount: 0,
      evaluatedCount: 0,
      averageGrade: null,
    });
    expect(profile.groups).toHaveLength(1);
    // Sin asignaciones no se consulta ni entregas ni runs.
    expect(deliveriesRepository.findByAssignmentIds).not.toHaveBeenCalled();
    expect(
      buildRunsRepository.findScalarSummaryByDeliveryIds,
    ).not.toHaveBeenCalled();
  });

  it('falla con 404 si el id no corresponde a un alumno', async () => {
    const { service } = buildService({ studentFound: false });

    await expect(
      service.getProfile('desconocido', actor(UserRole.ADMIN)),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
