/**
 * @fileoverview Root Module - Central de Conexiones e Inyección.
 *
 * ============================================================================
 * RAIZ DE MICROSERVICIOS Y CONECTIVIDAD
 * ============================================================================
 *
 * Este módulo sirve como Entry-Point Lógico (Grafo Principal) agregando todos los
 * submódulos funcionales del Monolito. Registramos el mapa de dependencias inyectables
 * (Dependency Injection Tree) en un contexto único (Singleton Scope nativo de Nest).
 *
 * Módulos integrados actualmente:
 * - `ConfigModule`: Carga de variables de entorno global (.env).
 * - `TypeOrmModule`: Conexión principal a PostgreSQL configurada asíncronamente.
 * - `BullModule`: Integración con Redis para el procesamiento de colas (Fase 3).
 * - `AuthModule`: Gestión de Sesiones JWT y Rutas Perimetrales de IAM.
 * - `UsersModule`: Gestión administrativa de identidades y RBAC.
 *
 * @module AppModule
 */

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import * as Joi from 'joi';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { User } from './users/entities/user.entity';

@Module({
  imports: [
    // Carga de variables de entorno global con validación estricta Fail-Fast
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../.env',
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test')
          .default('development'),
        PORT: Joi.number().default(3000),
        FRONTEND_URL: Joi.string().uri().default('http://localhost:5173'),
        DB_HOST: Joi.string().required(),
        DB_PORT: Joi.number().default(5432),
        DB_USERNAME: Joi.string().required(),
        DB_PASSWORD: Joi.string().required(),
        DB_NAME: Joi.string().required(),
        JWT_SECRET: Joi.string().required(),
        JWT_EXPIRES_IN: Joi.string().default('15m'),
        REDIS_HOST: Joi.string().required(),
        REDIS_PORT: Joi.number().default(6379),
      }),
    }),

    // Infraestructura de Logging JSON Estructurado
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV !== 'production' ? 'debug' : 'info',
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
      },
    }),

    // Protección Global frente a Fuerza Bruta (Rate Limiting)
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),

    // Orquestación de Base de Datos (PostgreSQL)
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get<string>('DB_USERNAME', 'postgres'),
        password: configService.get<string>('DB_PASSWORD', 'postgres'),
        database: configService.get<string>('DB_NAME', 'dockus'),
        entities: [User], // Mapeo automático de identidades
        synchronize: configService.get<string>('NODE_ENV') !== 'production', // Inhabilitado en producción
      }),
    }),

    // Infraestructura de Mensajería (Redis / BullMQ)
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
        },
      }),
    }),

    // Módulos funcionales de negocio
    UsersModule,
    AuthModule,
  ],
  controllers: [AppController], // Gateway Root (Healthchecks)
  providers: [AppService], // Providers de infraestructura global
})
export class AppModule {}
