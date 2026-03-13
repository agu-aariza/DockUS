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
  Request,
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
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
    role: string;
  };
}

@ApiTags('Identity Access Management (IAM)')
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * Endpoint de aprovisionamiento de identidades públicas.
   *
   * El registro genera una nueva identidad persistente con roles mínimos por defecto.
   * Manejamos colisiones de estado (409) y fallos de integridad de payload (400)
   * para asegurar un flujo de "Fail-Fast".
   */
  @ApiOperation({
    summary: 'Registrar un nuevo acceso',
    description:
      'Aprovisionamos un usuario seguro e inicializamos una sesión (JWT).',
  })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: 201,
    description: 'Identidad registrada y sesión inicializada.',
  })
  @ApiResponse({
    status: 400,
    description: 'Error de Validación',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflicto de Identidad: El email ya existe.',
  })
  @ApiResponse({
    status: 500,
    description: 'Error Interno',
  })
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // Max 5 registros por IP por minuto
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  /**
   * Emisor de Token de Acción (Login).
   */
  @ApiOperation({
    summary: 'Negociar sesión',
    description:
      'Emitimos token de autorización (JWT) tras validación de credenciales.',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Token JWT emitido exitosamente.' })
  @ApiResponse({
    status: 400,
    description: 'Error de Validación',
  })
  @ApiResponse({
    status: 401,
    description: 'Fallo de Autenticación',
  })
  @ApiResponse({
    status: 500,
    description: 'Error Interno',
  })
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // Max 10 intentos de login por IP por minuto
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /**
   * Endpoint de Reflexión de Identidad (Stateless).
   *
   * Este endpoint permite al cliente verificar la validez de su sesión actual
   * mediante la decodificación del Token Bearer sin necesidad de hits adicionales
   * a la base de datos de usuarios (Zero Trust Verification).
   */
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Reflejar estado de identidad actual',
    description: 'Verificamos y decodificamos localmente el JWT actual.',
  })
  @ApiResponse({
    status: 200,
    description: 'Contexto de identidad recuperado.',
  })
  @ApiResponse({
    status: 401,
    description: 'Acceso Denegado',
  })
  @ApiResponse({
    status: 500,
    description: 'Error Interno',
  })
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req: AuthenticatedRequest) {
    // La estrategia JWT ya decodificó e inyectó los metadatos puros.
    return req.user;
  }
}
