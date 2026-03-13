/**
 * @fileoverview Prueba end-to-end del arranque base de la API.
 *
 * Contexto:
 * - Verifica prefijo global, bootstrap compartido y endpoint raíz.
 * - Garantiza cierre correcto de la aplicación al finalizar.
 *
 * @module AppE2ESpec
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { applyAppBootstrap } from './../src/bootstrap';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

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
  });

  afterAll(async () => {
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
});
