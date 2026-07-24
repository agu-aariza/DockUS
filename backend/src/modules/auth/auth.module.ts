/**
 * @fileoverview Módulo de autenticación y estrategias JWT.
 *
 * Contexto:
 * - Configura providers de auth, controller y Passport.
 * - Registra JwtModule con configuración desde entorno.
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
import { CacheModule } from '../../shared/infrastructure/cache/cache.module';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    UsersModule, // Dependencia de capa de datos
    CacheModule, // Caché de identidad consumida por JwtStrategy (ESC-ALTO-04)
    PassportModule,
    // Factoría asíncrona para blindar secretos inyectados por .env dockerizado
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          // El valor por defecto lo fija Joi (`15m`), que además es el único
          // que llega a aplicarse porque `ConfigModule` valida con ese esquema.
          // Antes había aquí un respaldo de `1d` que nunca se usaba y que sí
          // engañaba a quien leyera el código: la auditoría de escalabilidad
          // dio por hecho que los tokens vivían un día (ESC-BAJO-04) cuando la
          // vida real, medida sobre un token emitido, son 15 minutos.
          expiresIn: configService.getOrThrow<string>(
            'JWT_EXPIRES_IN',
          ) as string & number,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [],
})
export class AuthModule {}
