/**
 * @fileoverview Auth Module - Factoría de Políticas IAM.
 *
 * ============================================================================
 * CONFIGURACION DE CONTEXTO DE AUTENTICACION
 * ============================================================================
 *
 * Definimos de manera centralizada la inyección de dependencias y las estrategias
 * de Passport.
 *
 * Parámetros Operacionales:
 * - Integramos `JwtModule` inyectando dinámicamente variables del entorno
 *   (ConfigService) garantizando políticas de "Zero Trust".
 *
 * @module AuthModule
 */
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    UsersModule, // Dependencia de capa de datos
    PassportModule,
    // Factoría asíncrona para blindar secretos inyectados por .env dockerizado
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: { expiresIn: configService.get('JWT_EXPIRES_IN') || '1d' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [],
})
export class AuthModule { }
