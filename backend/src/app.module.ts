/**
 * @fileoverview Root Module - Central de Conexiones e Inyección (AppModule).
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
 * - `ConfigModule`: Carga de variables de entorno global.
 * - `TypeOrmModule`: Conexión principal a PostgreSQL configurada asíncronamente.
 * - `AuthModule`: Gestión de Sesiones JWT y Rutas Perimetrales de IAM.
 * 
 * @module AppModule
 */

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { User } from './users/entities/user.entity';

@Module({
  imports: [
    // Carga de variables de entorno (DevSecOps Baseline)
    ConfigModule.forRoot({
      isGlobal: true, // Disponible en todos los módulos sin re-importar
      envFilePath: '../.env', // Ruta al archivo de secretos locales
    }),

    // Orquestación de Base de Datos
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
        entities: [User], // Importación directa de la entidad para auto-mapping
        synchronize: configService.get<string>('NODE_ENV') !== 'production', // Precaución: Automigraciones
      }),
    }),

    // Capa IAM
    AuthModule,
  ],
  controllers: [], // Mantenido intencionalmente limpio a nivel Global
  providers: [],   // Sin hooks globales de momento. Manejo via Inyectables/Middleware nativo.
})
export class AppModule { }