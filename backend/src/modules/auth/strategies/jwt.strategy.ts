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
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  /**
   * Resuelve la identidad autenticada a partir del JWT validado.
   */
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
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
