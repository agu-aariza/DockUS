/**
 * @fileoverview Servicio de negocio para registro e inicio de sesión.
 *
 * Contexto:
 * - Coordina validación de usuarios y emisión de JWT.
 * - Define respuestas de error consistentes para seguridad.
 *
 * @module AuthService
 */

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Logger } from 'nestjs-pino';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { RegisterDto, LoginDto } from './dto/auth.dto';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    role: string;
  };
  accessToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly logger: Logger,
  ) {}

  /**
   * Registra una nueva cuenta y devuelve un token para la sesión inicial.
   */
  async register(dto: RegisterDto): Promise<AuthResponse> {
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
   * Inicia sesión y devuelve un token JWT.
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
   * Valida credenciales y devuelve la identidad apta para autenticación.
   */
  private async validateLoginIdentity(dto: LoginDto): Promise<User> {
    const user = await this.usersService.findByEmailForAuth(dto.email, true);
    const activeUser = this.usersService.assertAccountIsActive(user);

    const isPasswordValid = await this.usersService.validatePassword(
      dto.password,
      activeUser.passwordHash,
    );

    if (!isPasswordValid) {
      this.logger.warn(
        `Login fallido: constraseña incorrecta para ${dto.email}`,
      );
      throw new UnauthorizedException('Credenciales inválidas proporcionadas.');
    }

    return activeUser;
  }

  /**
   * Genera el token JWT con la identidad mínima necesaria.
   */
  private generateToken(userId: string, email: string, role: string): string {
    const payload: JwtPayload = { sub: userId, email, role };
    return this.jwtService.sign(payload);
  }
}
