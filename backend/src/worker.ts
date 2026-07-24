/**
 * @fileoverview Punto de entrada del proceso Worker de segundo plano (BullMQ Consumer Engine).
 *
 * @description
 * Inicializa la aplicación NestJS sin puerto HTTP (usando `createApplicationContext`)
 * para el procesamiento de colas asíncronas de evaluación de código.
 * Se encarga de:
 * 1. Instanciar el contexto de inyección de dependencias de `WorkerModule`.
 * 2. Iniciar el refresco periódico del archivo de Heartbeat local para healthcheck de Docker.
 * 3. Escuchar trabajos de colas BullMQ en Redis para el motor Builder.
 * 4. Gestionar la parada ordenada del proceso ante señales SIGTERM/SIGINT (Graceful Shutdown).
 *
 * @module WorkerBootstrap
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { writeFile } from 'fs/promises';
import { WorkerModule } from './worker.module';

/** Ruta por defecto del archivo de pulso (heartbeat) para la sonda de salud del contenedor worker. */
const HEARTBEAT_PATH =
  process.env.WORKER_HEARTBEAT_PATH ?? '/tmp/dockus-worker.heartbeat';

/** Intervalo de refresco del pulso de salud en milisegundos. */
const HEARTBEAT_INTERVAL_MS = 10_000;

/**
 * Arranca el proceso Worker asíncrono y registra los escuchadores de paradas ordenadas.
 *
 * @returns Promesa que se resuelve tras iniciar el contexto de inyección.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule, {
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
