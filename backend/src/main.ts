/**
 * @fileoverview Punto de entrada del proceso HTTP.
 *
 * Contexto:
 * - Crea la instancia principal de Nest y aplica bootstrap común.
 * - Inicia escucha en el puerto configurado por entorno.
 *
 * @module MainBootstrap
 */

import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { applyAppBootstrap } from './bootstrap';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  applyAppBootstrap(app, {
    enableSwagger: true,
    enableShutdownHooks: true,
  });

  // Inicia escucha HTTP en el puerto configurado.
  const port = process.env.PORT || 3000;
  await app.listen(port);

  // Registra estado de arranque con logger estructurado.
  const logger = app.get(Logger);
  logger.log(`Kernel operativo en el puerto ${port}`, 'Bootstrap');
  logger.log(
    `Especificación OpenAPI disponible en: http://localhost:${port}/api/docs`,
    'Bootstrap',
  );
}

void bootstrap();
