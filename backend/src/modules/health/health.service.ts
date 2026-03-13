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
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { DataSource } from 'typeorm';

type DependencyStatus = 'up' | 'down';
type ReadinessStatus = 'ok' | 'error';

interface DependencyHealth {
  status: DependencyStatus;
  latencyMs: number;
  details?: string;
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
  };
}

const REDIS_TIMEOUT_MS = 2000;

@Injectable()
export class HealthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Indicador de vida del proceso HTTP principal.
   *
   * @returns Reporte mínimo para sondas de liveness.
   */
  getLiveness(): LivenessReport {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Indicador de preparación del servicio con dependencias externas.
   *
   * @returns Reporte consolidado de estado de base de datos y Redis.
   */
  async getReadiness(): Promise<ReadinessReport> {
    const [database, redis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const status: ReadinessStatus =
      database.status === 'up' && redis.status === 'up' ? 'ok' : 'error';

    return {
      status,
      timestamp: new Date().toISOString(),
      checks: { database, redis },
    };
  }

  /**
   * Chequeo activo de conectividad con PostgreSQL.
   *
   * @returns Estado de disponibilidad de la base de datos.
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
      return {
        status: 'down',
        latencyMs: Date.now() - startedAt,
        details: this.getErrorMessage(error),
      };
    }
  }

  /**
   * Chequeo activo de conectividad con Redis usando PING.
   *
   * @returns Estado de disponibilidad de Redis.
   */
  private async checkRedis(): Promise<DependencyHealth> {
    const startedAt = Date.now();
    const redisHost = this.configService.get<string>('REDIS_HOST', 'localhost');
    const redisPort = this.configService.get<number>('REDIS_PORT', 6379);

    const redisClient = new Redis({
      host: redisHost,
      port: redisPort,
      lazyConnect: true,
      connectTimeout: REDIS_TIMEOUT_MS,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 0,
      retryStrategy: () => null,
    });

    try {
      await redisClient.connect();
      const pong = await redisClient.ping();

      if (pong !== 'PONG') {
        throw new Error('Redis no respondió correctamente al comando PING.');
      }

      return {
        status: 'up',
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      return {
        status: 'down',
        latencyMs: Date.now() - startedAt,
        details: this.getErrorMessage(error),
      };
    } finally {
      redisClient.disconnect();
    }
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return 'Error no tipado durante el healthcheck.';
  }
}
