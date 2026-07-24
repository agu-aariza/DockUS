/**
 * @fileoverview Servicio de healthchecks para liveness y readiness.
 *
 * Contexto:
 * - Ejecuta chequeos reales sobre PostgreSQL y Redis.
 * - Entrega estado de dependencias para observabilidad operativa.
 *
 * @module HealthService
 */

import { Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import {
  BedrockClient,
  ListFoundationModelsCommand,
} from '@aws-sdk/client-bedrock';
import { RedisClientService } from '../../shared/infrastructure/cache/redis-client.service';
import {
  DOCKER_DAEMON_STATUS_REDIS_KEY,
  DockerDaemonStatusPayload,
} from '../../shared/infrastructure/docker/docker-daemon-status-publisher.service';

type DependencyStatus = 'up' | 'down';
type ReadinessStatus = 'ok' | 'error';

interface DependencyHealth {
  status: DependencyStatus;
  latencyMs: number;
  info?: string;
}

export interface LivenessReport {
  status: 'ok';
  timestamp: string;
}

export interface ReadinessReport {
  status: ReadinessStatus;
  timestamp: string;
  checks: {
    database: DependencyHealth;
    redis: DependencyHealth;
    docker: DependencyHealth;
    bedrock: DependencyHealth;
  };
}

@Injectable()
export class HealthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly redisClient: RedisClientService,
    private readonly configService: ConfigService,
    private readonly logger: Logger,
  ) {}

  /**
   * Devuelve el estado básico de liveness del proceso HTTP.
   */
  getLiveness(): LivenessReport {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Comprueba si las dependencias críticas están listas para recibir tráfico.
   */
  async getReadiness(): Promise<ReadinessReport> {
    const [database, redis, docker, bedrock] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkDocker(),
      this.checkBedrock(),
    ]);

    const status: ReadinessStatus =
      database.status === 'up' &&
      redis.status === 'up' &&
      docker.status === 'up' &&
      bedrock.status === 'up'
        ? 'ok'
        : 'error';

    return {
      status,
      timestamp: new Date().toISOString(),
      checks: { database, redis, docker, bedrock },
    };
  }

  /**
   * Comprueba conectividad con PostgreSQL.
   */
  private async checkDatabase(): Promise<DependencyHealth> {
    const startedAt = Date.now();

    try {
      await this.dataSource.query('SELECT 1');
      return {
        status: 'up',
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      this.logDependencyError('PostgreSQL', error);
      return {
        status: 'down',
        latencyMs: Date.now() - startedAt,
      };
    }
  }

  /**
   * Comprueba conectividad con Redis mediante PING.
   */
  private async checkRedis(): Promise<DependencyHealth> {
    const startedAt = Date.now();

    try {
      const pong = await this.redisClient.ping();

      if (pong !== 'PONG') {
        throw new Error('Redis no respondió correctamente al comando PING.');
      }

      return {
        status: 'up',
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      this.logDependencyError('Redis', error);
      return {
        status: 'down',
        latencyMs: Date.now() - startedAt,
      };
    }
  }

  /**
   * Comprueba el estado del daemon Docker leyendo lo que publica el worker en Redis
   * en vez de hablar con el daemon directamente desde la API HTTP.
   */
  private async checkDocker(): Promise<DependencyHealth> {
    const startedAt = Date.now();

    try {
      const raw = await this.redisClient.get(DOCKER_DAEMON_STATUS_REDIS_KEY);
      if (!raw) {
        throw new Error(
          'El worker no ha publicado el estado del daemon Docker recientemente ' +
            '(clave ausente o expirada en Redis).',
        );
      }

      const published = JSON.parse(raw) as DockerDaemonStatusPayload;
      if (published.status !== 'up') {
        throw new Error(
          published.info ?? 'El worker reporta el daemon Docker como caido.',
        );
      }

      return {
        status: 'up',
        latencyMs: Date.now() - startedAt,
        info: published.info,
      };
    } catch (error) {
      this.logDependencyError('Docker', error);
      return {
        status: 'down',
        latencyMs: Date.now() - startedAt,
      };
    }
  }

  private async checkBedrock(): Promise<DependencyHealth> {
    const startedAt = Date.now();
    const region = this.configService.get<string>('AWS_REGION', 'us-east-1');

    try {
      const client = new BedrockClient({ region });
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);

      try {
        await client.send(new ListFoundationModelsCommand({}), {
          abortSignal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }

      return {
        status: 'up',
        latencyMs: Date.now() - startedAt,
        info: `Bedrock accesible en ${region}.`,
      };
    } catch (error) {
      this.logDependencyError('Bedrock', error);
      return {
        status: 'down',
        latencyMs: Date.now() - startedAt,
        info: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private logDependencyError(dependencyName: string, error: unknown): void {
    this.logger.error(
      `Healthcheck de ${dependencyName} falló: ${this.getErrorMessage(error)}`,
      undefined,
      HealthService.name,
    );
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return 'Error no tipado durante el healthcheck.';
  }
}
