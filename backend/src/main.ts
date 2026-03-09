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
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(appModule);

  // Api Gateway Path Segment
  app.setGlobalPrefix('api');

  // Hardened Request Filtering Pipeline
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Auto-limpiamos campos no mapeados explícitamente en el ecosistema DTO
      forbidNonWhitelisted: true, // Fails-Fast si detectamos payloads no validados
      transform: true, // Convertimos pasivamente Request strings al Type correcto de TS
    }),
  );

  // Habilitamos CORS para interoperabilidad del Frontend
  app.enableCors();

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

  // Bind del puerto para ocker
  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`🚀 Kernel operativo en el puerto ${port}`);
  console.log(
    `📚 Especificación OpenAPI disponible en: http://localhost:${port}/api/docs`,
  );
}

/**
 * Variable global para evitar colisión de nombres de clase en bootstrap.
 * @internal
 */
const appModule = AppModule;

void bootstrap();
