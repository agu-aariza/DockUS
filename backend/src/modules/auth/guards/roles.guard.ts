/**
 * @fileoverview Guard y decorador para autorización por roles.
 *
 * Contexto:
 * - Define el decorador Roles para metadatos RBAC.
 * - Evalúa permisos del usuario autenticado por ruta.
 *
 * @module RolesGuard
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedRequest } from '../interfaces/authenticated-user.interface';
import { UserRole } from '../../users/entities/user.entity';

/** Clave de metadatos usada por el decorador `@Roles`. */
const ROLES_KEY = 'roles';

/**
 * Declara los roles permitidos para una ruta o controlador.
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  /**
   * Evalúa si la identidad actual tiene alguno de los roles requeridos.
   */
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const currentUserRole = request.user?.role;

    if (!currentUserRole) {
      return false;
    }

    return requiredRoles.includes(currentUserRole);
  }
}
