/**
 * @fileoverview Módulo transversal de infraestructura.
 *
 * Contexto:
 * - Agrupa configuración global, observabilidad y conectividad técnica.
 * - Libera a AppModule de responsabilidades no funcionales de negocio.
 *
 * @module InfrastructureModule
 */

import { BullModule } from '@nestjs/bullmq';
import { Module, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { envValidationSchema } from '../config/env.validation';
import { buildTypeOrmConfig } from './database/typeorm.config';
import { buildPinoHttpConfig } from './observability/logger.config';
import { buildBullConfig } from './queue/bull.config';
import { throttlerConfig } from './security/throttler.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../.env',
      validationSchema: envValidationSchema,
    }),

    LoggerModule.forRoot({
      pinoHttp: buildPinoHttpConfig(process.env.NODE_ENV),
      forRoutes: [{ path: '/{*path}', method: RequestMethod.ALL }],
    }),

    ThrottlerModule.forRoot(throttlerConfig),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        buildTypeOrmConfig(configService),
    }),

    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        buildBullConfig(configService),
    }),
  ],
})
export class InfrastructureModule {}
