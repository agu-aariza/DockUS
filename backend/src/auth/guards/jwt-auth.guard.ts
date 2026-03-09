/**
 * @fileoverview Auth Guard - Middleware Defensivo para Stateless JWT.
 *
 * ============================================================================
 * FIREWALL DE APLICACION - INTERCEPTOR DE SESION
 * ============================================================================
 *
 * Punto de control perimetral (Checkpoint Guard) para rutas marcadas como
 * de alto permiso temporal. Interceptamos y validamos los metadatos HTTP para
 * evitar el traspaso de contextos de identidad envenenados hacia los
 * Controladores Seguros.
 *
 * Procedimientos de Seguridad (Security Posture):
 * - Heredamos el pipeline de mitigación y parser Bearer interno de Passport.
 * - Denegación estricta automatizada por expiración (TTL Expired -> 401).
 * - Extraemos proactivamente el Payload firmado para la Request en el stack lógico interno.
 *
 * @module JwtAuthGuard
 * @requires @nestjs/common
 * @requires @nestjs/passport
 */

import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') { }
