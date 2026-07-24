/**
 * @fileoverview Servicio de caché de identidad de usuario para validación de tokens JWT.
 *
 * @description
 * Almacena en caché de Redis de corta duración (por defecto 30s) las identidades de usuario
 * validadas en cada petición HTTP con encabezado `Authorization: Bearer <token>`.
 * Evita la saturación del pool de conexiones PostgreSQL en escenarios de alta concurrencia.
 *
 * Modo de fallo (Fail-Open): Si Redis no responde dentro del presupuesto de tiempo (150ms),
 * cae de forma transparente a la consulta directa a PostgreSQL.
 *
 * @module AuthIdentityCacheService
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisClientService } from './redis-client.service';

/**
 * Únicamente primitivos: este fichero vive en `shared/` y no puede importar
 * entidades ni enumerados de `modules/` (dependencia de un solo sentido).
 *
 * Nótese que aquí **no** hay `status` ni `deletedAt`, y es deliberado. El plan
 * preveía cachear `{userId, role, status}` y reevaluar la regla de acceso sobre
 * el valor cacheado, pero eso duplica `UsersService.assertAccountIsActive` en
 * un segundo sitio que puede divergir del original en cualquier cambio futuro.
 * En su lugar solo se guardan identidades que **ya han superado** esa
 * comprobación, de modo que un acierto de caché significa exactamente "estaba
 * activa cuando se guardó". Una cuenta inactiva o borrada nunca llega a
 * cachearse: paga la consulta a base de datos y recibe el rechazo de la única
 * implementación que existe de la regla.
 */
export interface CachedAuthIdentity {
  userId: string;
  email: string;
  role: string;
}

const KEY_PREFIX = 'auth:identity:';
const DEFAULT_TTL_SECONDS = 30;

/**
 * Presupuesto de la operación de caché. Deliberadamente muy por debajo de lo
 * que tarda la consulta a la que sustituye: si Redis no contesta en este plazo,
 * ir a PostgreSQL es más rápido que seguir esperando.
 */
const CACHE_TIMEOUT_MS = 150;

@Injectable()
export class AuthIdentityCacheService {
  private readonly logger = new Logger(AuthIdentityCacheService.name);
  private readonly ttlSeconds: number;

  constructor(
    private readonly redisClientService: RedisClientService,
    configService: ConfigService,
  ) {
    this.ttlSeconds = configService.get<number>(
      'AUTH_IDENTITY_CACHE_TTL_SECONDS',
      DEFAULT_TTL_SECONDS,
    );
  }

  /** Con TTL 0 la caché queda inerte: interruptor de emergencia sin desplegar. */
  get isEnabled(): boolean {
    return this.ttlSeconds > 0;
  }

  async get(userId: string): Promise<CachedAuthIdentity | null> {
    if (!this.isEnabled) {
      return null;
    }

    try {
      const raw = await this.redisClientService.get(
        this.buildKey(userId),
        CACHE_TIMEOUT_MS,
      );
      if (!raw) {
        return null;
      }

      return this.parse(raw);
    } catch {
      // Silencioso a propósito: un Redis caído generaría una línea de registro
      // por petición y ahogaría el resto de la traza. La indisponibilidad ya la
      // reporta la sonda de salud, que es donde corresponde verla.
      return null;
    }
  }

  async set(identity: CachedAuthIdentity): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    try {
      await this.redisClientService.set(
        this.buildKey(identity.userId),
        JSON.stringify(identity),
        this.ttlSeconds,
        CACHE_TIMEOUT_MS,
      );
    } catch {
      // No poder escribir en la caché solo cuesta el trabajo de la próxima
      // lectura; la petición en curso ya tiene su respuesta.
    }
  }

  /**
   * Invalida la identidad tras una mutación.
   *
   * A diferencia de la lectura y la escritura, **este fallo sí se registra**:
   * significa que una cuenta modificada puede seguir operando con los datos
   * anteriores hasta que venza el TTL. Es la única vía por la que esta caché
   * puede provocar un problema de control de acceso, y tiene que ser visible.
   */
  async invalidate(userId: string): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    try {
      await this.redisClientService.del(
        this.buildKey(userId),
        CACHE_TIMEOUT_MS,
      );
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: 'auth_identity_cache_invalidation_failed',
          userId,
          ttlSeconds: this.ttlSeconds,
          detail: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  private buildKey(userId: string): string {
    return `${KEY_PREFIX}${userId}`;
  }

  /**
   * Tolerante con lo que haya en Redis: una entrada corrupta o escrita por una
   * versión anterior con otra forma se trata como fallo de caché, no como error
   * de autenticación.
   */
  private parse(raw: string): CachedAuthIdentity | null {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) {
        return null;
      }

      const candidate = parsed as Record<string, unknown>;
      if (
        typeof candidate.userId !== 'string' ||
        typeof candidate.email !== 'string' ||
        typeof candidate.role !== 'string'
      ) {
        return null;
      }

      return {
        userId: candidate.userId,
        email: candidate.email,
        role: candidate.role,
      };
    } catch {
      return null;
    }
  }
}
