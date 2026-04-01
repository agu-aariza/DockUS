/**
 * @fileoverview Inicialización global compartida de la aplicación.
 *
 * Contexto:
 * - Aplica middleware, validación, CORS y logger de forma centralizada.
 * - Permite reutilizar la misma configuración en main y e2e.
 *
 * @module AppBootstrap
 */

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

/**
 * Opciones para adaptar la inicialización al contexto de ejecución.
 */
interface BootstrapOptions {
  enableSwagger?: boolean;
  enableShutdownHooks?: boolean;
}

/**
 * Valores por defecto para la API en ejecución normal.
 */
const DEFAULT_BOOTSTRAP_OPTIONS: Required<BootstrapOptions> = {
  enableSwagger: process.env.NODE_ENV !== 'production',
  enableShutdownHooks: true,
};

/**
 * Aplica la configuración HTTP compartida por la aplicación.
 */
export function applyAppBootstrap(
  app: INestApplication,
  options: BootstrapOptions = {},
): void {
  const configService = app.get(ConfigService);
  const { enableSwagger, enableShutdownHooks } = {
    ...DEFAULT_BOOTSTRAP_OPTIONS,
    ...options,
  };

  app.setGlobalPrefix('api');
  app.useLogger(app.get(Logger));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.use(helmet());
  app.enableCors({
    origin: configService.get<string>(
      'FRONTEND_URL',
      configService.get<string>('NODE_ENV') === 'production'
        ? ''
        : 'http://localhost:5173',
    ),
    credentials: true,
  });

  if (enableShutdownHooks) {
    app.enableShutdownHooks();
  }

  if (enableSwagger) {
    const config = new DocumentBuilder()
      .setTitle('DockUS API')
      .setDescription(
        'Especificación técnica de los microservicios de DockUS para la gestión de entornos reproducibles.',
      )
      .setVersion('1.3.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }
}
