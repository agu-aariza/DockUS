/**
 * @fileoverview Punto de entrada del worker de procesamiento en segundo plano.
 *
 * Contexto:
 * - No abre puerto HTTP; consume trabajos de BullMQ (builder-runs) y ejecuta
 *   el pipeline de evaluación de entregas.
 * - Comparte base de datos, Redis y MinIO con la API HTTP.
 *
 * @module WorkerBootstrap
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { writeFile } from 'fs/promises';
import { AppWorkerModule } from './app.worker.module';

// Declara el rol antes de instanciar el contenedor: tareas de arranque que solo
// deben correr en el worker (p. ej. el barrido de runs huérfanos) se guían por
// esta señal, porque `AppModule` lo importan tanto la API como el worker.
process.env.DOCKUS_ROLE = 'worker';

// El worker no abre puerto HTTP, así que su healthcheck no puede sondear un
// endpoint. En su lugar refresca un fichero: si el proceso se cuelga o entra en
// un crash-loop, el fichero deja de actualizarse y el healthcheck lo detecta.
const HEARTBEAT_PATH =
  process.env.WORKER_HEARTBEAT_PATH ?? '/tmp/dockus-worker.heartbeat';
const HEARTBEAT_INTERVAL_MS = 10_000;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppWorkerModule, {
    bufferLogs: true,
  });

  const logger = new Logger('WorkerBootstrap');
  app.useLogger(logger);
  logger.log('Worker de builder iniciado y escuchando colas BullMQ.');

  const writeHeartbeat = (): void => {
    void writeFile(HEARTBEAT_PATH, String(Date.now())).catch(() => undefined);
  };
  writeHeartbeat();
  const heartbeat = setInterval(writeHeartbeat, HEARTBEAT_INTERVAL_MS);
  heartbeat.unref();

  const gracefulShutdown = async (signal: string): Promise<void> => {
    logger.log(
      `Recibida señal ${signal}. Cerrando worker de forma graceful...`,
    );
    clearInterval(heartbeat);
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => void gracefulShutdown('SIGINT'));
}

void bootstrap();
