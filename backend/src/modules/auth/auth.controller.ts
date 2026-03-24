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
import type {
  AuthenticatedRequest,
  AuthenticatedUser,
} from './interfaces/authenticated-user.interface';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('Identity Access Management (IAM)')
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Registra una cuenta y devuelve la sesión inicial.
   */
  @ApiOperation({
    summary: 'Registrar una cuenta',
    description: 'Crea un usuario y devuelve un JWT para la sesión inicial.',
  })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: 201,
    description: 'Identidad registrada y sesión inicializada.',
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
  @Throttle({ default: { limit: 5, ttl: 60000 } })
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
  @ApiResponse({ status: 200, description: 'Token JWT emitido exitosamente.' })
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
  @Throttle({ default: { limit: 10, ttl: 60000 } })
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
}
