/**
 * @fileoverview Roles Guard y Decorador @Roles - Control de Acceso RBAC.
 *
 * ============================================================================
 * CAPA DE AUTORIZACION BASADA EN ROLES (RBAC)
 * ============================================================================
 *
 * Implementamos un mecanismo de control de acceso granular para proteger los
 * recursos del sistema. Esta capa de seguridad permite definir quó roles
 * específicos pueden interactuar con cada controlador o endpoint.
 *
 * Componentes:
 * - `Roles`: Decorador de metadatos para asignar permisos.
 * - `RolesGuard`: Guardión lógico que evalóa el contexto de seguridad.
 *
 * Polóticas de Seguridad:
 * - Denegación por defecto: Si un endpoint requiere roles, el usuario debe poseer uno.
 * - Integración con JWT: Utiliza el objeto 'user' previamente establecido por el proceso de validación de tokens JWT.
 *
 * @module RolesGuard
 * @requires @nestjs/common
 * @requires @nestjs/core
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

/**
 * Clave de metadatos para la persistencia de roles requeridos en el Reflector.
 * @constant {string}
 */
export const ROLES_KEY = 'roles';

/**
 * Decorador de Clase/Mótodo para la asignación de permisos RBAC.
 *
 * @param {UserRole[]} roles - Lista de roles autorizados para el recurso.
 * @returns {CustomDecorator} Decorador de metadatos de NestJS.
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  /**
   * Inyectamos el Reflector para acceder a los metadatos de los controladores.
   * @param {Reflector} reflector - Utilidad de consulta de metadatos de NestJS.
   */
  constructor(private reflector: Reflector) { }

  /**
   * Evaluamos si la identidad actual posee los privilegios necesarios.
   *
   * @param {ExecutionContext} context - Contexto de la petición HTTP actual.
   * @returns {boolean} Resultado de la validación de acceso.
   */
  canActivate(context: ExecutionContext): boolean {
    // Recuperamos los roles configurados mediante el decorador @Roles.
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Si el recurso no tiene restricciones de rol, permitimos el paso (solo JWT requerido).
    if (!requiredRoles) {
      return true;
    }

    // Extraemos la identidad del usuario inyectada previamente por el Firewall de JWT.
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const currentUserRole = request.user?.role;

    // Si no existe rol en el contexto, denegamos por política de mínimo privilegio.
    if (!currentUserRole) {
      return false;
    }

    // Verificamos si el rol asignado a la identidad está incluido en los roles permitidos.
    return requiredRoles.includes(currentUserRole);
  }
}
