/**
 * @fileoverview Auth Controller - Gateway de Identidad y Sesiones.
 * 
 * ============================================================================
 * ENDPOINTS DE SEGURIDAD PERIMETRAL
 * ============================================================================
 * 
 * Responsables de la exposición controlada de micro-servicios de autenticación.
 * Actuamos como la única frontera permitida entre la red pública y los datos de
 * identidad internos.
 * 
 * Directivas Implementadas:
 * - DTO Validation en el punto de entrada (Fail-Fast a través de pipes).
 * - Generación automática de documentación OpenAPI (Swagger).
 * - Protección por Token en endpoints críticos (ej. `/auth/profile`).
 * 
 * @module AuthController
 * @requires @nestjs/common
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
export class AuthController {
  constructor(private authService: AuthService) { }

  /**
   * Endpoint de aprovisionamiento de identidades públicas.
   * Generamos el usuario con roles mínimos restrictivos por defecto.
   */
  @ApiOperation({
    summary: 'Registrar un nuevo acceso',
    description: 'Aprovisionamos un usuario seguro e inicializamos una sesión (JWT).',
  })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: 201,
    description: 'Identidad registrada.',
  })
  @ApiResponse({ status: 409, description: 'Identidad ya registrada.' })
  @ApiResponse({ status: 400, description: 'Validación DTO rechazada.' })
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  /**
   * Emisor de Token de Acción (Login).
   * Negociamos el JWT después de una confrontación criptográfica exitosa.
   */
  @ApiOperation({
    summary: 'Negociar sesión',
    description: 'Emitimos token de autorización (JWT) tras validación de credenciales.',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Token JWT emitido correctamente.',
  })
  @ApiResponse({ status: 401, description: 'Credenciales incorrectas.' })
  @HttpCode(200)
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /**
   * Endpoint de Verificación de Sesión y Perfil en caliente.
   * Sólo accesible proporcionando un Bearer Token válido no expirado en el header.
   */
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Reflejar estado de identidad actual',
    description: 'Verificamos y decodificamos localmente el JWT actual (Stateless).',
  })
  @ApiResponse({ status: 200, description: 'Token verificado y contexto proveído.' })
  @ApiResponse({ status: 401, description: 'Token inválido.' })
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req: AuthenticatedRequest) {
    // La estrategia JWT ya decodificó e inyectó los metadatos puros.
    return req.user;
  }
}
