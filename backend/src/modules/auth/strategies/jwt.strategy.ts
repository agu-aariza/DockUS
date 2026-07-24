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
import { AuthIdentityCacheService } from '../../../shared/infrastructure/cache/auth-identity-cache.service';
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
    private readonly authIdentityCache: AuthIdentityCacheService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  /**
   * Resuelve la identidad autenticada a partir del JWT validado.
   *
   * La consulta a `users` se sirve desde una caché de vida corta (ESC-ALTO-04):
   * corría en cada petición autenticada, y los sondeos de 3 s del frontend la
   * convertían en el consumidor dominante del pool de conexiones. La
   * invalidación al mutar la cuenta la hace `UsersService`; aquí solo se guarda
   * la identidad **después** de que `assertAccountIsActive` la haya aceptado,
   * de modo que un acierto de caché nunca puede saltarse esa comprobación.
   */
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const cached = await this.authIdentityCache.get(payload.sub);
    if (cached) {
      return {
        userId: cached.userId,
        email: cached.email,
        role: cached.role as AuthenticatedUser['role'],
      };
    }

    const user = await this.usersService.findById(payload.sub, true);
    const activeUser = this.usersService.assertAccountIsActive(
      user,
      'Sesión inválida: la identidad no se encuentra activa.',
    );

    await this.authIdentityCache.set({
      userId: activeUser.id,
      email: activeUser.email,
      role: activeUser.role,
    });

    return {
      userId: activeUser.id,
      email: activeUser.email,
      role: activeUser.role,
    };
  }
}
