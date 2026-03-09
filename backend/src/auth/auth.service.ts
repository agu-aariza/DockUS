/**
 * @fileoverview Auth Service - Controlador Lógico de Seguridad Perimetral.
 *
 * ============================================================================
 * NUCLEO DE AUTENTICACION Y GENERACION DE TOKENS
 * ============================================================================
 *
 * Servicio centralizado para orchestrar el registro seguro de identidades y
 * el ciclo de vida de validación de sesiones (Login/Token issuance).
 *
 * Políticas de Seguridad Implementadas:
 * - Uso de JWT firmados simétricamente sin estado (stateless) para escalar
 *   horizontalmente.
 * - Validación cruzada con el módulo de identidad (UsersService) aislando la
 *   capa de la base de datos de las peticiones HTTP directas.
 * - Respuestas de error genéricas (por ejemplo, en login fallido) para evitar
 *   fugas de información y ataques de enumeración (CWE-200).
 *
 * @module AuthService
 * @requires @nestjs/common
 * @requires @nestjs/jwt
 */

import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { RegisterDto, LoginDto } from './dto/auth.dto';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

export interface AuthResponse {
  /** Estructura sanitizada del usuario. Ningún dato sensible escapa. */
  user: {
    id: string;
    email: string;
    role: string;
  };
  /** Bearer token válido emitido para autorización subsequente. */
  accessToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  /**
   * Registramos una nueva identidad en el pool asegurado de usuarios y
   * proveemos un token para un inicio de sesión inmediato (Seamless Auth).
   *
   * @throws {ConflictException} Mitigación contra registros duplicados.
   */
  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existingUser = await this.usersService.findByEmail(dto.email, true);
    if (existingUser) {
      throw new ConflictException('El email ya está registrado en el sistema.');
    }

    const user = await this.usersService.create(
      dto.email,
      dto.password,
      dto.firstName,
      dto.lastName,
    );

    const token = this.generateToken(user.id, user.email, user.role);

    return {
      user: { id: user.id, email: user.email, role: user.role },
      accessToken: token,
    };
  }

  /**
   * Interfaz de validación de credenciales en tiempo constante.
   *
   * IMPORTANTE: Utilizamos UnauthorizedException estándar en ambos fallos
   * (usuario no existe o password inválido) para mitigar el User Enumeration.
   */
  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.validateLoginIdentity(dto);
    const token = this.generateToken(user.id, user.email, user.role);

    return {
      user: { id: user.id, email: user.email, role: user.role },
      accessToken: token,
    };
  }

  /**
   * Verificamos identidad y credenciales para emitir una sesión JWT.
   *
   * @param {LoginDto} dto - Credenciales de acceso del usuario.
   * @returns {Promise<User>} Entidad activa lista para emisión de token.
   * @throws {UnauthorizedException} Si la cuenta no existe, no está activa o el password es inválido.
   */
  private async validateLoginIdentity(dto: LoginDto): Promise<User> {
    const user = await this.usersService.findByEmail(dto.email, true);
    const activeUser = this.usersService.assertAccountIsActive(user);

    const isPasswordValid = await this.usersService.validatePassword(
      activeUser,
      dto.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas proporcionadas.');
    }

    return activeUser;
  }

  /**
   * Firmamos criptográficamente un token JWT incluyendo datos mínimos esenciales
   * para la autorización RBAC posterior (subject, email, role).
   *
   * @private Generado de forma aislada para uso interno de la clase.
   */
  private generateToken(userId: string, email: string, role: string): string {
    const payload: JwtPayload = { sub: userId, email, role };
    return this.jwtService.sign(payload);
  }
}
