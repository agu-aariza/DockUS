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
import { RedisClientService } from '../../shared/infrastructure/cache/redis-client.service';
import { DockerHostService } from '../../shared/infrastructure/docker/docker-host.service';

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
  };
}

@Injectable()
export class HealthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly redisClient: RedisClientService,
    private readonly dockerHost: DockerHostService,
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
    const [database, redis, docker] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkDocker(),
    ]);

    const status: ReadinessStatus =
      database.status === 'up' && redis.status === 'up' && docker.status === 'up'
        ? 'ok'
        : 'error';

    return {
      status,
      timestamp: new Date().toISOString(),
      checks: { database, redis, docker },
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
   * Comprueba conectividad con el daemon de Docker.
   */
  private async checkDocker(): Promise<DependencyHealth> {
    const startedAt = Date.now();

    try {
      const info = await this.dockerHost.inspectDockerHost({
        timeoutMs: 5000,
      });

      return {
        status: 'up',
        latencyMs: Date.now() - startedAt,
        info: `Docker version ${info.ServerVersion ?? 'unknown'}`,
      };
    } catch (error) {
      this.logDependencyError('Docker', error);
      return {
        status: 'down',
        latencyMs: Date.now() - startedAt,
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
