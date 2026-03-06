/**
 * @fileoverview Main Bootstrap - Entrada al Kernel de la SPA/API NestJS.
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
 *    colisiones si servimos un FrontEnd estático o Proxy Inverso (Nginx/Traefik).
 * - `ValidationPipe`: Filtro de protección exhaustivo contra Parameter Tampering.
 *   - `whitelist: true`: Purga masiva silenciosa de variables maliciosas extra.
 *   - `forbidNonWhitelisted: true`: Throw agresivo cortocircuitando exploits
 *      conocidos de "Mass Assignment" o "Prototype Pollution".
 * 
 * @module MainBootstrap
 */

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  console.log('=== NESTJS DB DEBUG ===');
  console.log('DB_USERNAME:', process.env.DB_USERNAME);
  console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '******' + process.env.DB_PASSWORD.slice(-4) : 'UNDEFINED');
  console.log('DB_NAME:', process.env.DB_NAME);
  console.log('CWD:', process.cwd());

  const app = await NestFactory.create(AppModule);

  // Api Gateway Path Segment (Para Infra/Ingress Proxies)
  app.setGlobalPrefix('api');

  // Hardened Request Filtering Pipeline
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, // Auto-limpiamos campos no mapeados explícitamente en el ecosistema DTO
    forbidNonWhitelisted: true, // Fails-Fast si detectamos payloads no validados
    transform: true, // Convertimos pasivamente Request strings al Type correcto de TS
  }));

  // ============================================================================
  // OPENAPI (SWAGGER) - AUTO-DOCUMENTACION INTERACTIVA
  // ============================================================================
  const config = new DocumentBuilder()
    .setTitle('DockUS API - Seguridad y Servicios')
    .setDescription('Especificación técnica de los microservicios de DockUS.')
    .setVersion('1.0.0')
    .addBearerAuth() // Añadimos el botón "Authorize" para probar el JWT
    .build();

  const document = SwaggerModule.createDocument(app, config);
  // Exponemos el portal en http://localhost:3000/api/docs
  SwaggerModule.setup('api/docs', app, document);

  // Bind del puerto para orquestador del cluster/contenedor Docker
  await app.listen(3000);
}
bootstrap();