/**
 * @fileoverview Publica en Redis el estado del daemon Docker (audit/04 ARQ-016).
 *
 * Contexto:
 * - La API ya no monta `docker.sock` ni puede hablar con el daemon
 *   directamente: `HealthService.checkDocker` antes llamaba a
 *   `DockerHostService.assertDockerAvailable` en el propio proceso de la API,
 *   lo que obligaba a exponerle el socket solo para esta sonda.
 * - El worker sí sigue montándolo (es quien ejecuta contenedores de verdad) y
 *   ya tenía un patrón de "avisar de que sigo vivo" sin HTTP: el heartbeat de
 *   fichero en `worker.ts`. Esto es lo mismo pero para el daemon en vez de
 *   para el proceso, y en Redis en vez de en un fichero porque la API sí
 *   necesita leerlo desde otro contenedor.
 * - TTL corto (60s, el doble del intervalo de publicación): si el worker cae
 *   o pierde acceso al daemon, la clave expira sola y `checkDocker` lo lee
 *   como "sin dato reciente" en vez de arrastrar un "up" obsoleto.
 *
 * @module DockerDaemonStatusPublisherService
 */

import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DockerHostService } from './docker-host.service';
import { RedisClientService } from '../cache/redis-client.service';
import { PROCESS_ROLE } from '../../../process-role.module';
import type { ProcessRole } from '../../../process-role.module';

export const DOCKER_DAEMON_STATUS_REDIS_KEY = 'dockus:docker-daemon:status';
const PUBLISH_INTERVAL_MS = 30_000;
const REDIS_KEY_TTL_SECONDS = 60;

export interface DockerDaemonStatusPayload {
  status: 'up' | 'down';
  info?: string;
  checkedAt: string;
}

@Injectable()
export class DockerDaemonStatusPublisherService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(DockerDaemonStatusPublisherService.name);
  private interval: NodeJS.Timeout | null = null;

  constructor(
    private readonly dockerHost: DockerHostService,
    private readonly redisClient: RedisClientService,
    private readonly configService: ConfigService,
    @Inject(PROCESS_ROLE) private readonly processRole: ProcessRole,
  ) {}

  onModuleInit(): void {
    if (this.processRole !== 'worker') {
      return;
    }
    void this.publishStatus();
    this.interval = setInterval(
      () => void this.publishStatus(),
      PUBLISH_INTERVAL_MS,
    );
    this.interval.unref?.();
  }

  onModuleDestroy(): void {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  private async publishStatus(): Promise<void> {
    const payload = await this.checkDaemon();
    await this.redisClient
      .set(
        DOCKER_DAEMON_STATUS_REDIS_KEY,
        JSON.stringify(payload),
        REDIS_KEY_TTL_SECONDS,
      )
      .catch((error: unknown) => {
        // Si Redis está caído, no hay dónde publicar el estado. La API lo
        // leerá como "sin dato reciente" en cuanto la clave expire — ya
        // degrada correctamente, no hace falta reintentar aquí.
        this.logger.warn(
          `No se pudo publicar el estado del daemon Docker en Redis: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      });
  }

  private async checkDaemon(): Promise<DockerDaemonStatusPayload> {
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    const sandboxRuntime = this.configService.get<string>(
      'BUILDER_DOCKER_RUNTIME',
      'runc',
    );

    try {
      const info = await this.dockerHost.assertDockerAvailable({
        nodeEnv,
        sandboxRuntime,
        timeoutMs: 5000,
      });
      return {
        status: 'up',
        info: `Docker version ${info.ServerVersion ?? 'unknown'} (runtime=${sandboxRuntime})`,
        checkedAt: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'down',
        info: error instanceof Error ? error.message : String(error),
        checkedAt: new Date().toISOString(),
      };
    }
  }
}
