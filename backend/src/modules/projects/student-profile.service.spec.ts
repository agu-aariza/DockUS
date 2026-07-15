import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { User, UserRole, UserStatus } from '../users/entities/user.entity';
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
import { StudentProfileService } from './student-profile.service';

describe('StudentProfileService', () => {
  const STUDENT_ID = 'student-1';
  const TEACHER_ID = 'teacher-1';

  const student = {
    id: STUDENT_ID,
    firstName: 'Alumno',
    lastName: 'Ariza',
    email: 'alumno1@dockus.com',
    role: UserRole.STUDENT,
    status: UserStatus.ACTIVE,
  } as User;

  const buildQueryBuilder = (assignments: ProjectAssignment[]) => {
    const qb = {
      innerJoinAndSelect: jest.fn(() => qb),
      leftJoinAndSelect: jest.fn(() => qb),
      where: jest.fn(() => qb),
      andWhere: jest.fn(() => qb),
      orderBy: jest.fn(() => qb),
      getMany: jest.fn(async () => assignments),
    };
    return qb;
  };

  const buildService = (options: {
    assignments?: ProjectAssignment[];
    deliveries?: Delivery[];
    runs?: BuildRun[];
    groups?: Array<{ id: string; name: string; code: string | null }>;
    studentFound?: boolean;
  }) => {
    const queryBuilder = buildQueryBuilder(options.assignments ?? []);

    const usersRepository = {
      findOne: jest.fn(async () =>
        options.studentFound === false ? null : student,
      ),
    } as unknown as Repository<User>;

    const assignmentsRepository = {
      createQueryBuilder: jest.fn(() => queryBuilder),
    } as unknown as Repository<ProjectAssignment>;

    const deliveriesRepository = {
      find: jest.fn(async () => options.deliveries ?? []),
    } as unknown as Repository<Delivery>;

    const buildRunsRepository = {
      find: jest.fn(async () => options.runs ?? []),
    } as unknown as Repository<BuildRun>;

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
      queryBuilder,
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
    email: 'actor@dockus.com',
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

    // La query de runs se filtra por deliveryId; jamás por triggeredById, que es
    // siempre el profesor y devolvería cero.
    const runQuery = jest.mocked(buildRunsRepository.find).mock.calls[0][0];
    expect(JSON.stringify(runQuery)).toContain('deliveryId');
    expect(JSON.stringify(runQuery)).not.toContain('triggeredById');

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

  it('acota al docente a los proyectos en los que está asignado', async () => {
    const { service, queryBuilder } = buildService({
      assignments: [buildAssignment()],
    });

    await service.getProfile(STUDENT_ID, actor(UserRole.TEACHER, TEACHER_ID));

    const scoping = queryBuilder.andWhere.mock.calls
      .map(([clause]) => String(clause))
      .join(' | ');
    expect(scoping).toContain('project_teachers');
  });

  it('no acota al administrador', async () => {
    const { service, queryBuilder } = buildService({
      assignments: [buildAssignment()],
    });

    await service.getProfile(STUDENT_ID, actor(UserRole.ADMIN));

    const scoping = queryBuilder.andWhere.mock.calls
      .map(([clause]) => String(clause))
      .join(' | ');
    expect(scoping).not.toContain('project_teachers');
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
    expect(deliveriesRepository.find).not.toHaveBeenCalled();
    expect(buildRunsRepository.find).not.toHaveBeenCalled();
  });

  it('excluye asignaciones revocadas', async () => {
    const { service, queryBuilder } = buildService({ assignments: [] });

    await service.getProfile(STUDENT_ID, actor(UserRole.ADMIN));

    const clauses = queryBuilder.andWhere.mock.calls
      .map(([clause]) => String(clause))
      .join(' | ');
    expect(clauses).toContain('assignment.revokedAt IS NULL');
  });

  it('falla con 404 si el id no corresponde a un alumno', async () => {
    const { service } = buildService({ studentFound: false });

    await expect(
      service.getProfile('desconocido', actor(UserRole.ADMIN)),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
