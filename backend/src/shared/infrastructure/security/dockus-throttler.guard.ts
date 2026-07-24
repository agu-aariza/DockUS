/**
 * @fileoverview Guard de rate limiting que cuenta por identidad autenticada.
 *
 * Contexto:
 * - `ThrottlerGuard` se registra como guard GLOBAL en `bootstrap.ts`, y en
 *   NestJS los guards globales se ejecutan antes que los de controlador. Cuando
 *   el throttler decide la clave de conteo, `JwtAuthGuard` todavía no se ha
 *   ejecutado y `req.user` no existe: contar por `req.user.userId` degradaba
 *   silenciosamente a IP en TODAS las peticiones, que es justo lo que ESC-C02
 *   pretendía corregir.
 * - Este guard resuelve la identidad por su cuenta, verificando la firma del
 *   token. Verificarla es imprescindible: aceptar el `sub` de un token sin
 *   comprobar equivaldría a dejar que cualquiera eligiera su propio cubo y
 *   sortease el límite generando identificadores al azar.
 *
 * @module DockusThrottlerGuard
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import type {
  ThrottlerModuleOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';
import { verify } from 'jsonwebtoken';
import { resolveClientIp } from './throttler.config';

@Injectable()
export class DockusThrottlerGuard extends ThrottlerGuard {
  private readonly jwtSecret: string;

  constructor(
    options: ThrottlerModuleOptions,
    storageService: ThrottlerStorage,
    reflector: Reflector,
    configService: ConfigService,
  ) {
    super(options, storageService, reflector);
    this.jwtSecret = configService.getOrThrow<string>('JWT_SECRET');
  }

  protected getTracker(req: Record<string, any>): Promise<string> {
    const userId = this.resolveUserId(req);
    if (userId) {
      return Promise.resolve(`user:${userId}`);
    }
    return Promise.resolve(`ip:${resolveClientIp(req)}`);
  }

  /**
   * Devuelve el identificador del token solo si su firma es válida. Un token
   * caducado, manipulado o ausente cae a `null` y la petición se cuenta por IP,
   * que es el comportamiento correcto para tráfico no autenticado.
   */
  private resolveUserId(req: Record<string, any>): string | null {
    // Si un guard anterior ya resolvió la identidad, se reutiliza sin volver a
    // verificar la firma.
    const resolved = (req as { user?: { userId?: string } }).user?.userId;
    if (resolved) {
      return resolved;
    }

    const header = (req.headers as Record<string, unknown> | undefined)
      ?.authorization;
    if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
      return null;
    }

    try {
      const payload = verify(header.slice('Bearer '.length), this.jwtSecret);
      if (typeof payload === 'object' && typeof payload.sub === 'string') {
        return payload.sub;
      }
      return null;
    } catch {
      return null;
    }
  }
}
