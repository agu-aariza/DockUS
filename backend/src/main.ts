/**
 * @fileoverview Punto de entrada del proceso HTTP API (NestJS REST Engine).
 *
 * @description
 * Inicializa la aplicación NestJS para el rol de servidor REST HTTP.
 * Se encarga de:
 * 1. Instanciar el módulo raíz de la API (`ApiModule`).
 * 2. Aplicar los middlewares e interceptores globales (`applyAppBootstrap`).
 * 3. Iniciar la escucha en el puerto asignado (por defecto 3000).
 * 4. Notificar la disponibilidad de la API y la especificación OpenAPI (Swagger).
 *
 * @module MainBootstrap
 */

import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { ApiModule } from './api.module';
import { applyAppBootstrap } from './bootstrap';

/**
 * Arranca el proceso HTTP REST.
 *
 * @returns Promesa que se resuelve una vez completado el enlace de red.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(ApiModule);

  applyAppBootstrap(app);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);

  const logger = app.get(Logger);
  logger.log(`Kernel API operativo en el puerto ${port}`, 'Bootstrap');
  logger.log(
    `Especificación OpenAPI disponible en: http://localhost:${port}/api/docs`,
    'Bootstrap',
  );
}

void bootstrap();
