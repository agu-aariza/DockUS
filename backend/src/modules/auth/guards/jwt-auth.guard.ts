/**
 * @fileoverview Guard de autenticación basado en JWT.
 *
 * Contexto:
 * - Extiende AuthGuard de Passport con estrategia jwt.
 * - Protege endpoints que requieren usuario autenticado.
 *
 * @module JwtAuthGuard
 */

import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
