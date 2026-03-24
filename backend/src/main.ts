/**
 * @fileoverview Punto de entrada del proceso HTTP.
 *
 * Contexto:
 * - Crea la instancia principal de Nest y aplica bootstrap común.
 * - Inicia escucha en el puerto configurado por entorno.
 *
 * @module MainBootstrap
 */

import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { applyAppBootstrap } from './bootstrap';

/**
 * Arranca el servidor HTTP principal.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  applyAppBootstrap(app);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);

  const logger = app.get(Logger);
  logger.log(`Kernel operativo en el puerto ${port}`, 'Bootstrap');
  logger.log(
    `Especificación OpenAPI disponible en: http://localhost:${port}/api/docs`,
    'Bootstrap',
  );
}

void bootstrap();
