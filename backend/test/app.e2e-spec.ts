/**
 * @fileoverview Pruebas end-to-end de flujos críticos de la API.
 *
 * Contexto:
 * - Verifica prefijo global, autenticación y autorización RBAC.
 * - Comprueba healthchecks y estructura paginada de usuarios.
 *
 * @module AppE2ESpec
 */

import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { In, Repository } from 'typeorm';
import { AppModule } from './../src/app.module';
import { applyAppBootstrap } from './../src/bootstrap';
import {
  BuildRun,
  BuildRunStatus,
} from './../src/modules/projects/builder/domain/entities/build-run.entity';
import { ProjectAssignment } from './../src/modules/projects/assignments/entities/project-assignment.entity';
import { Delivery } from './../src/modules/projects/deliveries/entities/delivery.entity';
import {
  Project,
  ProjectRuntimeEnvironmentStatus,
  ProjectStatus,
} from './../src/modules/projects/entities/project.entity';
import { User, UserRole } from './../src/modules/users/entities/user.entity';
import { UsersService } from './../src/modules/users/users.service';

interface AuthApiResponse {
  user: {
    id: string;
    email: string;
    role: string;
  };
  accessToken: string;
}

interface LivenessApiResponse {
  status: 'ok';
  timestamp: string;
}

interface DependencyCheck {
  status: 'up' | 'down';
  latencyMs: number;
}

interface ReadinessApiResponse {
  status: 'ok' | 'error';
  timestamp: string;
  checks: {
    database: DependencyCheck;
    redis: DependencyCheck;
  };
}

interface UserListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface UserListApiResponse {
  data: Record<string, unknown>[];
  meta: UserListMeta;
}

interface ProfileApiResponse {
  userId: string;
  email: string;
  role: UserRole;
}

interface ProjectApiResponse {
  id: string;
  opensAt?: string | null;
  closesAt?: string | null;
}

interface DeliveryApiResponse {
  id: string;
  isLate: boolean;
  grade: number | null;
}

interface ProjectAssignmentApiResponse {
  id: string;
}

interface BulkAssignApiResponse {
  assignments: ProjectAssignmentApiResponse[];
  summary: {
    assignedCount: number;
  };
}

interface EnqueueBuildRunApiResponse {
  buildRunId: string;
  status: BuildRunStatus;
  deliveryId: string;
}

interface BuildRunApiResponse {
  id: string;
  deliveryId: string;
  status: BuildRunStatus;
}

interface BuildRunListApiResponse {
  data: BuildRunApiResponse[];
  meta: UserListMeta;
}

const TEST_PASSWORD = 'DockUs!Pass123';

describe('DockUS API (e2e)', () => {
  jest.setTimeout(20000);

  let app: INestApplication<App>;
  let usersRepository: Repository<User>;
  let buildRunsRepository: Repository<BuildRun>;
  let projectsRepository: Repository<Project>;
  let assignmentsRepository: Repository<ProjectAssignment>;
  let deliveriesRepository: Repository<Delivery>;
  let usersService: UsersService;
  const createdUserIds: string[] = [];
  const createdProjectIds: string[] = [];
  const createdAssignmentIds: string[] = [];
  const createdDeliveryIds: string[] = [];

  let studentIdentity: AuthApiResponse;
  let teacherIdentity: AuthApiResponse;
  let studentToken = '';
  let teacherToken = '';

  const createUniqueEmail = (prefix: string): string =>
    `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2, 10)}@dockus.test`;

  const registerIdentity = async (email: string): Promise<AuthApiResponse> => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email,
        password: TEST_PASSWORD,
        firstName: 'E2E',
        lastName: 'Test',
      })
      .expect(201);

    const payload = response.body as AuthApiResponse;
    createdUserIds.push(payload.user.id);
    return payload;
  };

  const loginIdentity = async (email: string): Promise<AuthApiResponse> => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email,
        password: TEST_PASSWORD,
      })
      .expect(200);

    return response.body as AuthApiResponse;
  };

  const prepareRbacIdentities = async (): Promise<void> => {
    const studentEmail = createUniqueEmail('student');
    studentIdentity = await registerIdentity(studentEmail);
    studentToken = (await loginIdentity(studentIdentity.user.email))
      .accessToken;

    const teacherEmail = createUniqueEmail('teacher');
    teacherIdentity = await registerIdentity(teacherEmail);
    await usersService.update(teacherIdentity.user.id, {
      role: UserRole.TEACHER,
    });
    teacherToken = (await loginIdentity(teacherIdentity.user.email))
      .accessToken;
  };

  const createProjectAndDelivery = async (options?: {
    opensAt?: string;
    closesAt?: string;
    runtimeReady?: boolean;
  }): Promise<{
    projectId: string;
    assignmentId: string;
    deliveryId: string;
    delivery: DeliveryApiResponse;
  }> => {
    const projectResponse = await request(app.getHttpServer())
      .post('/api/projects')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: `Proyecto E2E ${Date.now()}`,
        contextAcademico: 'Builder async tests',
        opensAt: options?.opensAt,
        closesAt: options?.closesAt,
      })
      .expect(201);

    const projectPayload = projectResponse.body as ProjectApiResponse;
    createdProjectIds.push(projectPayload.id);

    if (options?.runtimeReady) {
      await projectsRepository.update(projectPayload.id, {
        status: ProjectStatus.ACTIVE,
        runtimeEnvironmentStatus: ProjectRuntimeEnvironmentStatus.READY,
        runtimeNetworkName: `dockus-workspace-${projectPayload.id.slice(0, 12)}`,
        runtimeProvisionedAt: new Date(),
        runtimeLastError: null,
      });
    }

    const bulkAssignResponse = await request(app.getHttpServer())
      .post(`/api/projects/${projectPayload.id}/assignments/bulk`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        studentIds: [studentIdentity.user.id],
      })
      .expect(201);

    const bulkAssignPayload = bulkAssignResponse.body as BulkAssignApiResponse;
    const assignmentId = bulkAssignPayload.assignments[0]?.id;
    expect(assignmentId).toEqual(expect.any(String));
    createdAssignmentIds.push(assignmentId);

    const deliveryResponse = await request(app.getHttpServer())
      .post('/api/deliveries')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        assignmentId,
        notes: 'Entrega para pruebas e2e del builder async',
      })
      .expect(201);

    const deliveryPayload = deliveryResponse.body as DeliveryApiResponse;
    createdDeliveryIds.push(deliveryPayload.id);

    return {
      projectId: projectPayload.id,
      assignmentId,
      deliveryId: deliveryPayload.id,
      delivery: deliveryPayload,
    };
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Reutilizamos la misma configuración global sin Swagger ni hooks de apagado.
    applyAppBootstrap(app, {
      enableSwagger: false,
      enableShutdownHooks: false,
    });
    await app.init();

    usersRepository = app.get<Repository<User>>(getRepositoryToken(User));
    buildRunsRepository = app.get<Repository<BuildRun>>(
      getRepositoryToken(BuildRun),
    );
    projectsRepository = app.get<Repository<Project>>(
      getRepositoryToken(Project),
    );
    assignmentsRepository = app.get<Repository<ProjectAssignment>>(
      getRepositoryToken(ProjectAssignment),
    );
    deliveriesRepository = app.get<Repository<Delivery>>(
      getRepositoryToken(Delivery),
    );
    usersService = app.get(UsersService);
    await prepareRbacIdentities();
  });

  afterAll(async () => {
    if (buildRunsRepository && createdDeliveryIds.length > 0) {
      await buildRunsRepository.delete({
        deliveryId: In(createdDeliveryIds),
      });
    }

    if (deliveriesRepository && createdDeliveryIds.length > 0) {
      await deliveriesRepository.delete(createdDeliveryIds);
    }

    if (assignmentsRepository && createdAssignmentIds.length > 0) {
      await assignmentsRepository.delete(createdAssignmentIds);
    }

    if (projectsRepository && createdProjectIds.length > 0) {
      await projectsRepository.delete(createdProjectIds);
    }

    if (usersRepository && createdUserIds.length > 0) {
      await usersRepository.delete(createdUserIds);
    }

    if (app) {
      await app.close();
    }
  });

  it('/api (GET) debe responder 404 al no exponer alias en la raíz', () => {
    return request(app.getHttpServer()).get('/api').expect(404);
  });

  it('/ (GET) debe responder 404 por prefijo global /api', () => {
    return request(app.getHttpServer()).get('/').expect(404);
  });

  it('/api/health/live (GET)', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/health/live')
      .expect(200);

    const liveness = response.body as LivenessApiResponse;
    expect(liveness.status).toBe('ok');
    expect(typeof liveness.timestamp).toBe('string');
  });

  it('/api/health/readiness (GET)', async () => {
    const response = await request(app.getHttpServer()).get(
      '/api/health/readiness',
    );
    expect([200, 503]).toContain(response.status);

    const readiness = response.body as ReadinessApiResponse;

    expect(['ok', 'error']).toContain(readiness.status);
    expect(typeof readiness.timestamp).toBe('string');
    expect(['up', 'down']).toContain(readiness.checks.database.status);
    expect(['up', 'down']).toContain(readiness.checks.redis.status);
    expect(typeof readiness.checks.database.latencyMs).toBe('number');
    expect(typeof readiness.checks.redis.latencyMs).toBe('number');

    const allDependenciesUp =
      readiness.checks.database.status === 'up' &&
      readiness.checks.redis.status === 'up';

    expect(readiness.status).toBe(allDependenciesUp ? 'ok' : 'error');
    expect(response.status).toBe(allDependenciesUp ? 200 : 503);
  });



  it('/api/auth/register (POST) crea un usuario y emite token', async () => {
    const email = createUniqueEmail('register');
    const registerResponse = await registerIdentity(email);

    expect(registerResponse.user.email).toBe(email);
    expect(registerResponse.accessToken).toEqual(expect.any(String));
  });

  it('/api/auth/login + /api/auth/profile valida identidad autenticada', async () => {
    const loginResponse = await loginIdentity(studentIdentity.user.email);

    expect(loginResponse.user.id).toBe(studentIdentity.user.id);
    expect(loginResponse.user.role).toBe(UserRole.STUDENT);

    const profileResponse = await request(app.getHttpServer())
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${loginResponse.accessToken}`)
      .expect(200);

    const profile = profileResponse.body as ProfileApiResponse;
    expect(profile.userId).toBe(studentIdentity.user.id);
    expect(profile.email).toBe(studentIdentity.user.email);
    expect(profile.role).toBe(UserRole.STUDENT);
  });

  it('/api/users (GET) bloquea acceso al rol STUDENT', async () => {
    await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(403);
  });

  it('/api/users (GET) permite rol TEACHER y retorna estructura paginada', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/users?page=1&limit=5')
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200);

    const usersList = response.body as UserListApiResponse;
    expect(Array.isArray(usersList.data)).toBe(true);
    expect(usersList.meta.page).toBe(1);
    expect(usersList.meta.limit).toBe(5);
    expect(typeof usersList.meta.total).toBe('number');
    expect(typeof usersList.meta.totalPages).toBe('number');
    expect(typeof usersList.meta.hasNextPage).toBe('boolean');
    expect(typeof usersList.meta.hasPrevPage).toBe('boolean');

    if (usersList.data.length > 0) {
      expect('passwordHash' in usersList.data[0]).toBe(false);
    }
  });

  it('/api/builder/deliveries/:id/run (POST) devuelve 202 al encolar ejecución', async () => {
    const { deliveryId } = await createProjectAndDelivery({
      runtimeReady: true,
    });

    const response = await request(app.getHttpServer())
      .post(`/api/builder/deliveries/${deliveryId}/run`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(202);

    const payload = response.body as EnqueueBuildRunApiResponse;
    expect(payload.deliveryId).toBe(deliveryId);
    expect(payload.status).toBe(BuildRunStatus.QUEUED);
    expect(payload.buildRunId).toEqual(expect.any(String));
  });

  it('/api/builder/runs/:id (GET) devuelve estado válido del run', async () => {
    const { deliveryId } = await createProjectAndDelivery({
      runtimeReady: true,
    });
    const enqueueResponse = await request(app.getHttpServer())
      .post(`/api/builder/deliveries/${deliveryId}/run`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(202);

    const enqueuePayload = enqueueResponse.body as EnqueueBuildRunApiResponse;
    const response = await request(app.getHttpServer())
      .get(`/api/builder/runs/${enqueuePayload.buildRunId}`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200);

    const runPayload = response.body as BuildRunApiResponse;
    expect(runPayload.id).toBe(enqueuePayload.buildRunId);
    expect(runPayload.deliveryId).toBe(deliveryId);
    expect([
      BuildRunStatus.QUEUED,
      BuildRunStatus.BUILDING,
      BuildRunStatus.SUCCESS,
      BuildRunStatus.FAILED,
      BuildRunStatus.CANCELLED,
    ]).toContain(runPayload.status);
  });

  it('/api/builder/deliveries/:id/runs (GET) devuelve historial paginado', async () => {
    const { deliveryId } = await createProjectAndDelivery({
      runtimeReady: true,
    });
    const enqueueResponse = await request(app.getHttpServer())
      .post(`/api/builder/deliveries/${deliveryId}/run`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(202);
    const enqueuePayload = enqueueResponse.body as EnqueueBuildRunApiResponse;

    const response = await request(app.getHttpServer())
      .get(`/api/builder/deliveries/${deliveryId}/runs?page=1&limit=10`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200);

    const payload = response.body as BuildRunListApiResponse;
    expect(Array.isArray(payload.data)).toBe(true);
    expect(payload.meta.page).toBe(1);
    expect(payload.meta.limit).toBe(10);
    expect(
      payload.data.some((run) => run.id === enqueuePayload.buildRunId),
    ).toBe(true);
  });

  it('/api/builder/deliveries/:id/run (POST) devuelve 409 si ya existe run activo', async () => {
    const { deliveryId } = await createProjectAndDelivery({
      runtimeReady: true,
    });

    await buildRunsRepository.save({
      deliveryId,
      triggeredById: teacherIdentity.user.id,
      status: BuildRunStatus.QUEUED,
      warnings: [],
    });

    await request(app.getHttpServer())
      .post(`/api/builder/deliveries/${deliveryId}/run`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(409);
  });

  it('/api/builder/deliveries/:id/run (POST) retorna 404 cuando la entrega no existe', async () => {
    await request(app.getHttpServer())
      .post('/api/builder/deliveries/550e8400-e29b-41d4-a716-446655440000/run')
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(404);
  });

  it('/api/deliveries (POST) marca la entrega como tardía cuando el cierre ya venció', async () => {
    const closesAt = new Date(Date.now() - 60_000).toISOString();
    const { delivery } = await createProjectAndDelivery({ closesAt });

    expect(delivery.isLate).toBe(true);
    expect(delivery.grade).toBeNull();
  });

  it('/api/deliveries/:id/grading (PATCH) permite registrar nota y observaciones', async () => {
    const { deliveryId } = await createProjectAndDelivery();

    const response = await request(app.getHttpServer())
      .patch(`/api/deliveries/${deliveryId}/grading`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        grade: 8.5,
        graderNotes: 'Buena entrega, faltó cerrar un caso borde.',
      })
      .expect(200);

    const payload = response.body as DeliveryApiResponse & {
      graderNotes: string | null;
    };
    expect(payload.grade).toBe(8.5);
    expect(payload.graderNotes).toContain('caso borde');
  });

  it('/api/projects/:id/progress-summary/export (GET) devuelve un CSV con el progreso', async () => {
    const { projectId, deliveryId } = await createProjectAndDelivery();

    await request(app.getHttpServer())
      .patch(`/api/deliveries/${deliveryId}/grading`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        grade: 9,
        graderNotes: 'Excelente trabajo.',
      })
      .expect(200);

    const response = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/progress-summary/export`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200);

    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.text).toContain('studentId,studentName,studentEmail');
    expect(response.text).toContain(studentIdentity.user.email);
  });
});
