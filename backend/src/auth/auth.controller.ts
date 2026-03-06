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
   * 
   * Nota Arquitectónica: 
   * El registro genera una nueva identidad persistente con roles mínimos por defecto.
   * Manejamos colisiones de estado (409) y fallos de integridad de payload (400)
   * para asegurar un flujo de "Fail-Fast".
   */
  @ApiOperation({
    summary: 'Registrar un nuevo acceso',
    description: 'Aprovisionamos un usuario seguro e inicializamos una sesión (JWT).',
  })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, description: 'Identidad registrada y sesión inicializada.' })
  @ApiResponse({ status: 400, description: 'Error de Validación: El payload no cumple con los requisitos del esquema.' })
  @ApiResponse({ status: 409, description: 'Conflicto de Identidad: El vector de email ya existe en el registro.' })
  @ApiResponse({ status: 500, description: 'Error Interno: Fallo crítico en el subsistema de persistencia o cifrado.' })
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  /**
   * Emisor de Token de Acción (Login).
   * 
   * Nota Operacional:
   * Implementamos un override de HttpCode(200) para cumplir con el estándar RFC 7231,
   * ya que esta operación es puramente de intercambio de secretos y no aprovisiona
   * recursos nuevos persistentes, facilitando la interpretación por balanceadores.
   */
  @ApiOperation({
    summary: 'Negociar sesión',
    description: 'Emitimos token de autorización (JWT) tras validación de credenciales.',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Token JWT emitido exitosamente.' })
  @ApiResponse({ status: 400, description: 'Payload Malformado: Los datos de entrada son sintácticamente incorrectos.' })
  @ApiResponse({ status: 401, description: 'Fallo de Autenticación: Credenciales revocadas o inexistentes.' })
  @ApiResponse({ status: 500, description: 'Fallo Crítico: Inoperatividad temporal del servicio de criptografía.' })
  @HttpCode(200)
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /**
   * Endpoint de Reflexión de Identidad (Stateless).
   * 
   * Nota de Seguridad:
   * Este endpoint permite al cliente verificar la validez de su sesión actual
   * mediante la decodificación del Token Bearer sin necesidad de hits adicionales
   * a la base de datos de usuarios (Zero Trust Verification).
   */
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Reflejar estado de identidad actual',
    description: 'Verificamos y decodificamos localmente el JWT actual (Stateless).',
  })
  @ApiResponse({ status: 200, description: 'Contexto de identidad recuperado.' })
  @ApiResponse({ status: 401, description: 'Acceso Denegado: Token ausente, expirado o manipulado.' })
  @ApiResponse({ status: 500, description: 'Fallo del Gateway: Error en el proceso de desencriptación.' })
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req: AuthenticatedRequest) {
    // La estrategia JWT ya decodificó e inyectó los metadatos puros.
    return req.user;
  }
}
