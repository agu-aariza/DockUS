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
import {
  createOllamaConnectivityError,
  createOllamaHttpError,
  createOllamaTimeoutError,
  hasOllamaModel,
  normalizeOllamaModelNames,
  OllamaRequestError,
} from '../../shared/infrastructure/ai/ollama-request.util';

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
    ollama: DependencyHealth;
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
    const [database, redis, docker, ollama] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkDocker(),
      this.checkOllama(),
    ]);

    const status: ReadinessStatus =
      database.status === 'up' &&
      redis.status === 'up' &&
      docker.status === 'up' &&
      ollama.status === 'up'
        ? 'ok'
        : 'error';

    return {
      status,
      timestamp: new Date().toISOString(),
      checks: { database, redis, docker, ollama },
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

  private async checkOllama(): Promise<DependencyHealth> {
    const startedAt = Date.now();
    const baseUrl = this.configService.get<string>(
      'BUILDER_OLLAMA_BASE_URL',
      'http://ollama:11434',
    );
    const timeoutMs = Math.min(
      this.configService.get<number>('BUILDER_OLLAMA_TIMEOUT_MS', 120000),
      5000,
    );
    const requiredModels = [
      this.configService.get<string>(
        'BUILDER_OLLAMA_PLAN_MODEL',
        'dockus-builder-plan',
      ),
      this.configService.get<string>(
        'BUILDER_OLLAMA_EVAL_MODEL',
        'dockus-builder-eval',
      ),
      this.configService.get<string>(
        'BUILDER_OLLAMA_QUALITY_MODEL',
        'dockus-builder-quality',
      ),
    ];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${baseUrl}/api/tags`, {
        method: 'GET',
        signal: controller.signal,
      });

      if (!response.ok) {
        const details = await response.text();
        throw createOllamaHttpError({
          baseUrl,
          target: 'listado de modelos',
          status: response.status,
          details,
        });
      }

      const payload = await response.json();
      const availableModels = normalizeOllamaModelNames(payload);
      const missingModels = requiredModels.filter(
        (requiredModel) => !hasOllamaModel(availableModels, requiredModel),
      );

      if (missingModels.length > 0) {
        const info = `Faltan modelos Ollama requeridos en ${baseUrl}: ${missingModels.join(', ')}`;
        this.logDependencyError('Ollama', new Error(info));
        return {
          status: 'down',
          latencyMs: Date.now() - startedAt,
          info,
        };
      }

      return {
        status: 'up',
        latencyMs: Date.now() - startedAt,
        info: `Ollama listo en ${baseUrl}. ${requiredModels.length}/${requiredModels.length} modelos requeridos disponibles.`,
      };
    } catch (error) {
      let normalizedError: Error;
      if (error instanceof OllamaRequestError) {
        normalizedError = error;
      } else if (error instanceof Error && error.name === 'AbortError') {
        normalizedError = createOllamaTimeoutError(
          baseUrl,
          'consultar modelos requeridos',
        );
      } else {
        normalizedError = createOllamaConnectivityError(baseUrl, error);
      }

      this.logDependencyError('Ollama', normalizedError);
      return {
        status: 'down',
        latencyMs: Date.now() - startedAt,
        info: normalizedError.message,
      };
    } finally {
      clearTimeout(timeout);
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
