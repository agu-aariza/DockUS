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
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { User } from './users/entities/user.entity';

@Module({
  imports: [
    // Carga de variables de entorno global
    ConfigModule.forRoot({
      isGlobal: true, // Disponible en todos los módulos sin re-importar
      envFilePath: '../.env', // Ruta al archivo de secretos locales
    }),

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
export class AppModule { }
