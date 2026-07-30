/**
 * @fileoverview Servicio de negocio para registro, inicio de sesión y refresh tokens.
 *
 * Contexto:
 * - Coordina validación de usuarios y emisión de JWT.
 * - Emite un par accessToken (corta vida) + refreshToken (larga vida).
 * - Define respuestas de error consistentes para seguridad.
 *
 * @module AuthService
 */

import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { UsersService } from '../users/application/users.service';
import { User } from '../users/entities/user.entity';
import { RegisterDto, LoginDto } from './dto/auth.dto';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

interface RefreshPayload {
  sub: string;
  type: 'refresh';
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    role: string;
  };
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly refreshSecret: string;
  private readonly refreshExpiresIn: string;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly logger: Logger,
  ) {
    // Usa un secreto separado para refresh tokens; si no se configura, reutiliza el secreto JWT.
    this.refreshSecret =
      this.configService.get<string>('JWT_REFRESH_SECRET') ||
      this.configService.getOrThrow<string>('JWT_SECRET') + '_refresh';
    this.refreshExpiresIn =
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d';
  }

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

    return this.buildAuthResponse(user);
  }

  /**
   * Inicia sesión y devuelve un par de tokens JWT.
   */
  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.validateLoginIdentity(dto);
    return this.buildAuthResponse(user);
  }

  /**
   * Renueva el access token a partir de un refresh token válido.
   */
  async refresh(refreshToken: string): Promise<AuthResponse> {
    let payload: RefreshPayload;
    try {
      payload = this.jwtService.verify<RefreshPayload>(refreshToken, {
        secret: this.refreshSecret,
      });
    } catch {
      throw new ForbiddenException('Refresh token inválido o expirado.');
    }

    if (payload.type !== 'refresh') {
      throw new ForbiddenException(
        'Token proporcionado no es un refresh token.',
      );
    }

    const user = await this.usersService.findById(payload.sub);
    const activeUser = this.usersService.assertAccountIsActive(
      user,
      'La cuenta asociada al refresh token ya no está activa.',
    );

    return this.buildAuthResponse(activeUser);
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
   * Construye la respuesta de autenticación completa con ambos tokens.
   */
  private buildAuthResponse(user: User): AuthResponse {
    const accessToken = this.generateAccessToken(
      user.id,
      user.email,
      user.role,
    );
    const refreshToken = this.generateRefreshToken(user.id);

    return {
      user: { id: user.id, email: user.email, role: user.role },
      accessToken,
      refreshToken,
    };
  }

  /**
   * Genera el access token JWT con la identidad mínima necesaria.
   */
  private generateAccessToken(
    userId: string,
    email: string,
    role: string,
  ): string {
    const payload: JwtPayload = { sub: userId, email, role };
    return this.jwtService.sign(payload);
  }

  /**
   * Genera un refresh token de larga duración con secreto separado.
   */
  private generateRefreshToken(userId: string): string {
    const payload: RefreshPayload = { sub: userId, type: 'refresh' };
    return this.jwtService.sign(payload, {
      secret: this.refreshSecret,
      expiresIn: this.refreshExpiresIn as never,
    });
  }
}
