/**
 * @fileoverview Controlador de autenticación y sesión.
 *
 * Contexto:
 * - Expone endpoints de registro, login y perfil autenticado.
 * - Aplica DTOs y guards para proteger el acceso.
 *
 * @module AuthController
 */

import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Req,
  HttpCode,
} from '@nestjs/common';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import {
  INTERNAL_SERVER_ERROR_DESCRIPTION,
  INVALID_INPUT_DESCRIPTION,
  UNAUTHORIZED_DESCRIPTION,
} from '../../shared/http/http-response.constants';
import { AuthResponse, AuthService } from './auth.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import type {
  AuthenticatedRequest,
  AuthenticatedUser,
} from './interfaces/authenticated-user.interface';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('Identity Access Management (IAM)')
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Registra una cuenta pública y devuelve sesión inicial.
   */
  @ApiOperation({
    summary: 'Registrar una cuenta',
    description: 'Crea un usuario y devuelve una sesión inicial autenticada.',
  })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: 201,
    description: 'Identidad registrada y sesión inicializada.',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: INVALID_INPUT_DESCRIPTION,
  })
  @ApiResponse({
    status: 409,
    description: 'El email ya está reservado por otra cuenta.',
  })
  @ApiResponse({
    status: 500,
    description: INTERNAL_SERVER_ERROR_DESCRIPTION,
  })
  @Throttle({
    global: { limit: 10, ttl: 60000 },
    burst: { limit: 3, ttl: 1000 },
  })
  @Post('register')
  async register(@Body() dto: RegisterDto): Promise<AuthResponse> {
    return this.authService.register(dto);
  }

  /**
   * Inicia sesión y devuelve un nuevo JWT.
   */
  @ApiOperation({
    summary: 'Iniciar sesión',
    description: 'Valida credenciales y devuelve un token JWT.',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Token JWT emitido exitosamente.',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: INVALID_INPUT_DESCRIPTION,
  })
  @ApiResponse({
    status: 401,
    description: 'Credenciales inválidas.',
  })
  @ApiResponse({
    status: 500,
    description: INTERNAL_SERVER_ERROR_DESCRIPTION,
  })
  @HttpCode(200)
  @Throttle({
    global: { limit: 10, ttl: 60000 },
    burst: { limit: 3, ttl: 1000 },
  })
  @Post('login')
  async login(@Body() dto: LoginDto): Promise<AuthResponse> {
    return this.authService.login(dto);
  }

  /**
   * Devuelve la identidad autenticada resuelta por la estrategia JWT.
   */
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Consultar sesión actual',
    description: 'Devuelve la identidad autenticada del token actual.',
  })
  @ApiResponse({
    status: 200,
    description: 'Identidad autenticada recuperada.',
  })
  @ApiResponse({
    status: 401,
    description: UNAUTHORIZED_DESCRIPTION,
  })
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Req() req: AuthenticatedRequest): AuthenticatedUser {
    return req.user;
  }

  /**
   * Renueva los tokens de sesión usando un refresh token válido.
   */
  @ApiOperation({
    summary: 'Renovar tokens de sesión',
    description:
      'Valida un refresh token y emite un nuevo par accessToken + refreshToken.',
  })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({
    status: 200,
    description: 'Tokens renovados exitosamente.',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Refresh token inválido o expirado.',
  })
  @ApiResponse({
    status: 500,
    description: INTERNAL_SERVER_ERROR_DESCRIPTION,
  })
  @HttpCode(200)
  @Throttle({
    global: { limit: 10, ttl: 60000 },
    burst: { limit: 3, ttl: 1000 },
  })
  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto): Promise<AuthResponse> {
    return this.authService.refresh(dto.refreshToken);
  }
}
