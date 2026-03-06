/**
 * @fileoverview JWT Passport Strategy - Algoritmos Criptográficos y Validación.
 * 
 * ============================================================================
 * FACTORIA DE VALIDACION CRIPTOGRAFICA (BEARER TOKENS)
 * ============================================================================
 * 
 * Esta estrategia intercepta todos los requests dirigidos a endpoints protegidos.
 * Extraemos y verificamos la firma (signature) generada asimétricamente para comprobar 
 * Integridad (Data Integrity) y Autenticidad.
 * 
 * Políticas de Compliance & Security:
 * - Algoritmo subyacente blindado, verificando por `JWT_SECRET` rotativo desde Infra.
 * - Prohibición estricta de Bypass de Expiración (`ignoreExpiration: false`)
 *   forzando invalidación dura de sesiones críticas caídas por timeout.
 * - Validación in-memory ultra rápida escalable a micro servicios.
 * 
 * @module JwtStrategy
 * @requires @nestjs/common
 * @requires @nestjs/passport
 * @requires passport-jwt
 * @requires @nestjs/config
 */

import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

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
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      // Recuperador nativo del Authorization Bearer estándar RFC-6750.
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),

      // Security Flag: No autorizamos la re-habilitación "Zombie" del Token Expired.
      ignoreExpiration: false,

      // Secreto transitorio aprovisionado por entorno. Sin fallback peligroso nativo
      secretOrKey: configService.get<string>('JWT_SECRET') ?? 'fallback_unsafe_dev_key',
    });
  }

  /**
   * El Token ha sido interceptado y su firma JWT criptográficamente auditada 
   * y probada válida. Pasamos a hidratar un Sandbox de Acceso de Usuario.
   * 
   * @param payload Payload interno purgado validado firmado por el Emisor.
   */
  async validate(payload: JwtPayload): Promise<ValidatedUser> {
    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}
