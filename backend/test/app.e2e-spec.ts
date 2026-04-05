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
import { Repository } from 'typeorm';
import { AppModule } from './../src/app.module';
import { applyAppBootstrap } from './../src/bootstrap';
import {
  BuildRun,
  BuildRunStatus,
} from './../src/modules/projects/builder/domain/entities/build-run.entity';
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
}

interface DeliveryApiResponse {
  id: string;
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
  let usersService: UsersService;
  const createdUserIds: string[] = [];

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

  const createProjectAndDelivery = async (): Promise<{
    projectId: string;
    deliveryId: string;
  }> => {
    const projectResponse = await request(app.getHttpServer())
      .post('/api/projects')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: `Proyecto E2E ${Date.now()}`,
        contextAcademico: 'Builder async tests',
      })
      .expect(201);

    const projectPayload = projectResponse.body as ProjectApiResponse;

    const deliveryResponse = await request(app.getHttpServer())
      .post('/api/deliveries')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        projectId: projectPayload.id,
        version: Date.now(),
        notes: 'Entrega para pruebas e2e del builder async',
      })
      .expect(201);

    const deliveryPayload = deliveryResponse.body as DeliveryApiResponse;

    return {
      projectId: projectPayload.id,
      deliveryId: deliveryPayload.id,
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
    usersService = app.get(UsersService);
    await prepareRbacIdentities();
  });

  afterAll(async () => {
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
    const { deliveryId } = await createProjectAndDelivery();

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
    const { deliveryId } = await createProjectAndDelivery();
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
    const { deliveryId } = await createProjectAndDelivery();
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
    const { deliveryId } = await createProjectAndDelivery();

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
});
