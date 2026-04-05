/**
 * @fileoverview Configuración de conexión TypeORM.
 *
 * Contexto:
 * - Construye opciones de PostgreSQL a partir de variables de entorno.
 * - Activa autoLoadEntities para reducir acoplamiento entre dominios.
 *
 * @module TypeOrmConfig
 */

import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export function buildTypeOrmConfig(
  configService: ConfigService,
): TypeOrmModuleOptions {
  const nodeEnv = configService.get<string>('NODE_ENV');

  return {
    type: 'postgres',
    host: configService.get<string>('DB_HOST', 'localhost'),
    port: configService.get<number>('DB_PORT', 5432),
    username: configService.get<string>('DB_USERNAME', 'postgres'),
    password: configService.get<string>('DB_PASSWORD', 'postgres'),
    database: configService.get<string>('DB_NAME', 'dockus'),
    autoLoadEntities: true,
    synchronize: nodeEnv === 'development' || nodeEnv === 'test',
  };
}
