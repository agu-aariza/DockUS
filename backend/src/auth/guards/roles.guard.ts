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
import { UserRole } from '../../users/entities/user.entity';

interface AuthenticatedRequest {
  user?: {
    role?: UserRole;
  };
}

/** Clave de metadatos usada por el decorador `@Roles`. */
export const ROLES_KEY = 'roles';

/**
 * Decorador de clase/método para declarar roles permitidos.
 *
 * @param roles Lista de roles autorizados para el recurso.
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  /**
   * Inyecta el reflector para leer metadatos definidos con `@Roles`.
   */
  constructor(private reflector: Reflector) {}

  /**
   * Evalúa si la identidad actual posee los privilegios necesarios.
   *
   * @param context Contexto de la petición HTTP actual.
   * @returns `true` si el usuario está autorizado.
   */
  canActivate(context: ExecutionContext): boolean {
    // Recupera roles declarados en método o controlador.
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Si no hay restricciones de rol, se permite el paso.
    if (!requiredRoles) {
      return true;
    }

    // Obtiene la identidad cargada previamente por JwtAuthGuard.
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const currentUserRole = request.user?.role;

    // Si no hay rol en el contexto, deniega por mínimo privilegio.
    if (!currentUserRole) {
      return false;
    }

    // Autoriza solo si el rol actual está dentro de los permitidos.
    return requiredRoles.includes(currentUserRole);
  }
}
