/**
 * @fileoverview Estrategia Passport para validación de JWT.
 *
 * Contexto:
 * - Extrae y valida el token Bearer de Authorization.
 * - Carga la identidad activa para reforzar controles de acceso.
 *
 * @module JwtStrategy
 */

import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';
import { UserRole } from '../../users/entities/user.entity';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

interface ValidatedUser {
  userId: string;
  email: string;
  role: UserRole;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private usersService: UsersService,
  ) {
    super({
      // Extrae el token del header Authorization estándar.
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),

      // No permite reutilizar tokens expirados.
      ignoreExpiration: false,

      // Secreto obligatorio: sin fallback inseguro.
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  /**
   * Con el token ya validado, cargamos al usuario y verificamos que su cuenta
   * continúe activa en el sistema.
   *
   * @param payload Carga útil del JWT emitido por la API.
   */
  async validate(payload: JwtPayload): Promise<ValidatedUser> {
    const user = await this.usersService.findById(payload.sub, true);
    const activeUser = this.usersService.assertAccountIsActive(
      user,
      'Sesión inválida: la identidad no se encuentra activa.',
    );

    return {
      userId: activeUser.id,
      email: activeUser.email,
      role: activeUser.role,
    };
  }
}
