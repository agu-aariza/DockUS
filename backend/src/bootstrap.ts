/**
 * @fileoverview Inicialización y configuración global compartida de la API NestJS.
 *
 * @description
 * Modulo centralizador de middleware y seguridad HTTP. Se encarga de:
 * 1. Definir el prefijo global `/api` para todas las rutas REST.
 * 2. Configurar el registrador de logs Pino (`nestjs-pino`).
 * 3. Enforzar `ValidationPipe` global con sanitización estricta (`whitelist` y `forbidNonWhitelisted`).
 * 4. Registrar `DockusThrottlerGuard` para la protección contra abusos/rate-limiting.
 * 5. Configurar encabezados de seguridad HTTP vía `helmet` y políticas CORS restrictivas.
 * 6. Generar la especificación y UI de Swagger/OpenAPI en `/api/docs`.
 *
 * @module AppBootstrap
 */

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { DockusThrottlerGuard } from './shared/infrastructure/security/dockus-throttler.guard';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

/**
 * Opciones para adaptar la inicialización al contexto de ejecución (ej. entorno de tests E2E vs producción).
 */
interface BootstrapOptions {
  /** Indica si se debe generar y publicar la especificación Swagger/OpenAPI. */
  enableSwagger?: boolean;
  /** Indica si se deben habilitar los ganchos de cierre ordenado (`enableShutdownHooks`). */
  enableShutdownHooks?: boolean;
}

/**
 * Valores por defecto de configuración de arranque.
 */
const DEFAULT_BOOTSTRAP_OPTIONS: Required<BootstrapOptions> = {
  enableSwagger: process.env.NODE_ENV !== 'production',
  enableShutdownHooks: true,
};

/**
 * Resuelve los orígenes permitidos por la política CORS a partir de las variables de entorno.
 *
 * @param frontendUrl - Cadena delimitada por comas con las URLs del cliente web.
 * @param nodeEnv - Entorno de ejecución (`development`, `test`, `production`).
 * @returns Lista de orígenes de red autorizados.
 */
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
 * Aplica la configuración de seguridad, validación y CORS a la aplicación NestJS.
 *
 * @param app - Instancia de la aplicación NestJS HTTP.
 * @param options - Opciones opcionales de personalización del proceso de bootstrap.
 * @throws Error Si el entorno es `production` y no se ha definido `FRONTEND_URL`.
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
  app.useGlobalGuards(app.get(DockusThrottlerGuard));
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
        'Especificación técnica de la API de DockUS para la gestión de entornos reproducibles.',
      )
      .setVersion('1.3.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }
}
