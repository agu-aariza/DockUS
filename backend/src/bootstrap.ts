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
import { ThrottlerGuard } from '@nestjs/throttler';
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

function resolveFrontendOrigins(
  frontendUrl: string | undefined,
  nodeEnv: string | undefined,
): string[] {
  if (frontendUrl?.trim()) {
    return frontendUrl
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  if (nodeEnv === 'production') {
    return [];
  }

  return ['http://localhost:5173', 'http://127.0.0.1:5173'];
}

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
  const nodeEnv = configService.get<string>('NODE_ENV');
  const frontendUrl = configService.get<string>('FRONTEND_URL');
  const allowedOrigins = resolveFrontendOrigins(frontendUrl, nodeEnv);

  app.setGlobalPrefix('api');
  app.useLogger(app.get(Logger));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalGuards(app.get(ThrottlerGuard));
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          connectSrc: [
            "'self'",
            ...allowedOrigins,
            ...allowedOrigins.map((origin) =>
              origin.startsWith('http')
                ? origin.replace(/^http/, 'ws')
                : origin,
            ),
          ],
          imgSrc: ["'self'", 'data:', 'https:'],
          styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
        },
      },
    }),
  );

  if (nodeEnv === 'production' && !frontendUrl) {
    throw new Error(
      'FRONTEND_URL is required in production for CORS configuration.',
    );
  }

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin ${origin} no permitida por CORS.`), false);
    },
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
