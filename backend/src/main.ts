/**
 * @fileoverview Main Bootstrap - Entrada al Kernel de la API NestJS.
 *
 * ============================================================================
 * BOOTSTRAP KERNEL - INITIALIZATION VECTOR
 * ============================================================================
 *
 * Orquestador principal que instancía la máquina inyectora de dependencias y
 * asegura las capas middleware globales antes de poner el servidor a escuchar.
 *
 * Strict Global Pipeline Rules implementadas:
 * - `GlobalPrefix ('api')`: Segmentación del Path de Enrutamiento para evitar
 *    colisiones si servimos un FrontEnd estático o Proxy Inverso.
 * - `ValidationPipe`: Filtro de protección exhaustivo contra Parameter Tampering.
 *   - `whitelist: true`: Purga de variables maliciosas extra.
 *   - `forbidNonWhitelisted: true`: Throw agresivo cortocircuitando exploits
 *      conocidos de "Mass Assignment" o "Prototype Pollution".
 * - `CORS`: Habilitación selectiva de recursos compartidos entre orígenes.
 *
 * @module MainBootstrap
 */

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(appModule);

  // Api Gateway Path Segment
  app.setGlobalPrefix('api');

  // Instanciamos el Logger Global JSON (Pino)
  app.useLogger(app.get(Logger));

  // Hardened Request Filtering Pipeline
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Auto-limpiamos campos no mapeados explícitamente en el ecosistema DTO
      forbidNonWhitelisted: true, // Fails-Fast si detectamos payloads no validados
      transform: true, // Convertimos pasivamente Request strings al Type correcto de TS
    }),
  );

  // Security Headers (Mitigación XSS, Clickjacking, MIME Sniffing, etc.)
  app.use(helmet());

  // Habilitamos CORS de forma restringida (Evitar '*' en producción)
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  });

  // Graceful Shutdown: Intercepta SIGTERM/SIGINT para drenar conexiones
  app.enableShutdownHooks();

  // ============================================================================
  // OPENAPI (SWAGGER) - AUTO-DOCUMENTACION INTERACTIVA
  // ============================================================================
  const config = new DocumentBuilder()
    .setTitle('DockUS API - Seguridad y Servicios')
    .setDescription(
      'Especificación técnica de los microservicios de DockUS para la gestión de entornos reproducibles.',
    )
    .setVersion('1.0.0')
    .addBearerAuth() // Añadimos el botón "Authorize" para probar el JWT
    .addTag(
      'Identity Access Management (IAM)',
      'Endpoints de registro, login y perfil',
    )
    .addTag(
      'User Administration (RBAC)',
      'Gestión administrativa de usuarios con control de roles',
    )
    .addTag('System Health', 'Health checks y monitoreo de infraestructura')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  // Exponemos el portal en http://localhost:3000/api/docs
  SwaggerModule.setup('api/docs', app, document);

  // Bind del puerto para container orchestration
  const port = process.env.PORT || 3000;
  await app.listen(port);

  // Usamos el logger estandarizado en vez de console.log
  const logger = app.get(Logger);
  logger.log(`Kernel operativo en el puerto ${port}`, 'Bootstrap');
  logger.log(
    `Especificación OpenAPI disponible en: http://localhost:${port}/api/docs`,
    'Bootstrap',
  );
}

/**
 * Variable global para evitar colisión de nombres de clase en bootstrap.
 * @internal
 */
const appModule = AppModule;

void bootstrap();
