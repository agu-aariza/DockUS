/**
 * @fileoverview Configuración global de rate limiting.
 *
 * Contexto:
 * - Tres cubos independientes, cada uno con su propia clave de conteo.
 * - `global` → ventana de 60 s, límite alto para permitir navegación fluida
 *              en el workspace (múltiples GET simultáneos al cambiar de proyecto).
 * - `burst`  → ventana de 1 s, límite bajo para absorber ráfagas normales
 *              sin permitir flood real.
 * - `auth-identity` → ventana de 60 s por CORREO, no por IP. Es lo que frena
 *              realmente la fuerza bruta: un atacante que rote direcciones
 *              sigue chocando contra el mismo cubo.
 *
 * Los dos primeros cuentan **por identidad autenticada**, no por IP:
 * un aula entera tras el NAT del campus comparte una sola dirección, y con
 * conteo por IP el undécimo alumno del minuto no podía ni iniciar sesión.
 * La IP se conserva como respaldo para peticiones anónimas, que no tienen otra
 * clave disponible.
 *
 * Los endpoints de autenticación relajan `global`/`burst` a valores compatibles
 * con un aula y se apoyan en `auth-identity` para la protección real.
 *
 * @module ThrottlerConfig
 */

import type { ExecutionContext } from '@nestjs/common';
import { createHash } from 'crypto';

interface ThrottlerRequestLike {
  ip?: string;
  ips?: string[];
  user?: { userId?: string };
  body?: unknown;
}

/**
 * Cuenta por usuario autenticado cuando lo hay. `JwtAuthGuard` resuelve la
 * identidad antes de este punto en las rutas protegidas; en las públicas no hay
 * usuario y solo queda la dirección de origen.
 */
export function trackByUserOrIp(req: ThrottlerRequestLike): string {
  const userId = req.user?.userId;
  if (userId) {
    return `user:${userId}`;
  }
  return `ip:${resolveClientIp(req)}`;
}

/**
 * Cuenta por el correo que se intenta autenticar. Se normaliza para que
 * variaciones de mayúsculas no multipliquen la cuota del mismo buzón.
 */
export function trackByAuthIdentity(req: ThrottlerRequestLike): string {
  const email = readEmail(req);
  if (email) {
    return `email:${email}`;
  }
  // Sin correo el cubo se salta (véase `skipIf`); este valor no llega a usarse
  // salvo carrera, y degradar a IP es la opción conservadora.
  return `ip:${resolveClientIp(req)}`;
}

function readEmail(req: ThrottlerRequestLike): string | null {
  const body = req.body;
  if (!body || typeof body !== 'object') {
    return null;
  }
  const value = (body as Record<string, unknown>).email;
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }
  return value.trim().toLowerCase();
}

function readRefreshToken(req: ThrottlerRequestLike): string | null {
  const body = req.body;
  if (!body || typeof body !== 'object') {
    return null;
  }
  const value = (body as Record<string, unknown>).refreshToken;
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }
  return value.trim();
}

/**
 * Cuenta por el propio refresh token (hasheado, nunca en claro en la clave de
 * Redis). `/auth/refresh` no trae `email` en el body, así que
 * `auth-identity` nunca se activa ahí — sin este cubo, `/refresh` corría solo
 * con `global`/`burst` relajados, sin ninguna protección por identidad. No se
 * decodifica/verifica el JWT: eso añadiría una verificación de firma previa al
 * guard (superficie nueva) para un beneficio marginal, ya que un refresh token
 * es un secreto de alta entropía, no una contraseña adivinable — lo que
 * interesa frenar es la reutilización repetida de un token concreto (robado o
 * replay), no una enumeración (criptográficamente inviable de todos modos).
 */
export function trackByRefreshToken(req: ThrottlerRequestLike): string {
  const token = readRefreshToken(req);
  if (token) {
    return `refresh:${createHash('sha256').update(token).digest('hex')}`;
  }
  // Sin refresh token el cubo se salta (véase `skipIf`).
  return `ip:${resolveClientIp(req)}`;
}

export function resolveClientIp(req: ThrottlerRequestLike): string {
  return req.ips?.[0] ?? req.ip ?? 'unknown';
}

function requestOf(context: ExecutionContext): ThrottlerRequestLike {
  return context.switchToHttp().getRequest<ThrottlerRequestLike>();
}

export const throttlerConfig = [
  {
    name: 'global',
    ttl: 60_000,
    limit: 1_000,
  },
  {
    name: 'burst',
    ttl: 1_000,
    limit: 40,
  },
  {
    name: 'auth-identity',
    ttl: 60_000,
    limit: 10,
    getTracker: (req: ThrottlerRequestLike) =>
      Promise.resolve(trackByAuthIdentity(req)),
    // Solo interviene cuando la petición trae un correo que autenticar; en el
    // resto de rutas no hay nada que contar y el cubo se ignora.
    skipIf: (context: ExecutionContext) =>
      readEmail(requestOf(context)) === null,
  },
  {
    // Protección por identidad equivalente a `auth-identity`, pero para
    // `/auth/refresh`, que no tiene correo en el body.
    name: 'refresh-identity',
    ttl: 60_000,
    limit: 10,
    getTracker: (req: ThrottlerRequestLike) =>
      Promise.resolve(trackByRefreshToken(req)),
    skipIf: (context: ExecutionContext) =>
      readRefreshToken(requestOf(context)) === null,
  },
];

/**
 * Límites de los endpoints de autenticación. Se aplican con `@Throttle` en
 * `AuthController` y relajan los dos cubos por IP a valores compatibles con un
 * aula completa: la protección frente a fuerza bruta la aporta `auth-identity`,
 * que cuenta por correo y no por origen.
 */
export const authThrottleOverrides = {
  global: { limit: 300, ttl: 60_000 },
  burst: { limit: 20, ttl: 1_000 },
};
