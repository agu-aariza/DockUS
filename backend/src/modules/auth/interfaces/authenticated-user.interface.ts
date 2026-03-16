/**
 * @fileoverview Tipos compartidos para identidad autenticada en HTTP.
 *
 * Contexto:
 * - Define la forma del usuario inyectado por la estrategia JWT.
 * - Unifica el tipado entre controladores, guards y estrategias.
 *
 * @module AuthenticatedUser
 */

import { Request } from 'express';
import { UserRole } from '../../users/entities/user.entity';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: UserRole;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
