/**
 * @fileoverview Guard de limitación de tasa de peticiones (Rate Limiting / Throttling) por usuario autenticado.
 *
 * @description
 * Extiende `ThrottlerGuard` de NestJS para agrupar y contar peticiones por la identidad del usuario (`userId`)
 * en lugar de por la dirección IP cuando la petición incluye un token JWT válido. Cae a IP para peticiones anónimas.
 *
 * @module EduCodeAIThrottlerGuard
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
export class EduCodeAIThrottlerGuard extends ThrottlerGuard {
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
