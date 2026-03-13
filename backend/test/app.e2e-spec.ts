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
import { User, UserRole } from './../src/modules/users/entities/user.entity';

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
  details?: string;
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

const TEST_PASSWORD = 'DockUs!Pass123';

describe('DockUS API (e2e)', () => {
  let app: INestApplication<App>;
  let usersRepository: Repository<User>;
  const createdUserIds: string[] = [];

  let studentIdentity: AuthApiResponse;
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
    const teacherIdentity = await registerIdentity(teacherEmail);
    await usersRepository.update(teacherIdentity.user.id, {
      role: UserRole.TEACHER,
    });
    teacherToken = (await loginIdentity(teacherIdentity.user.email))
      .accessToken;
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
    await prepareRbacIdentities();
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await usersRepository.delete(createdUserIds);
    }

    await app.close();
  });

  it('/api (GET)', () => {
    return request(app.getHttpServer())
      .get('/api')
      .expect(200)
      .expect('Hello World!');
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
});
