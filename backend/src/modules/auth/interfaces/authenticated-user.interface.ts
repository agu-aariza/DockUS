/**
 * @fileoverview Tipos compartidos para identidad autenticada en HTTP.
 *
 * Contexto:
 * - Define la forma del usuario inyectado por la estrategia JWT.
 * - Unifica el tipado entre controladores, guards y estrategias.
 *
 * @module AuthenticatedUser
 */

import type { Request } from 'express';
import { UserRole } from '../../users/entities/user.entity';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: UserRole;
}

/**
 * `id` no se declara aquí: `pino-http` ya lo añade al `Request` de Express con
 * el tipo `ReqId` (`string | number | object`). Para propagarlo a la carga útil
 * de un trabajo se normaliza a texto con `toCorrelationId`.
 */
export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
