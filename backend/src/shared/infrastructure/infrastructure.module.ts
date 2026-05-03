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
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { envValidationSchema } from '../config/env.validation';
import { RedisClientService } from './cache/redis-client.service';
import { buildTypeOrmConfig } from './database/typeorm.config';
import { buildPinoHttpConfig } from './observability/logger.config';
import { buildBullConfig } from './queue/bull.config';
import { throttlerConfig } from './security/throttler.config';
import { AdminSeedService } from './seed/admin-seed.service';
import { DemoSeedService } from './seed/demo-seed.service';
import { User } from '../../modules/users/entities/user.entity';
import { Project } from '../../modules/projects/entities/project.entity';
import { ProjectAssignment } from '../../modules/projects/assignments/entities/project-assignment.entity';
import { Delivery } from '../../modules/projects/deliveries/entities/delivery.entity';

import { DockerInfrastructureModule } from './docker/docker-infrastructure.module';
import { AiModule } from './ai/ai.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../.env',
      validationSchema: envValidationSchema,
    }),

    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        pinoHttp: buildPinoHttpConfig(configService.get<string>('NODE_ENV')),
        forRoutes: [{ path: '/{*path}', method: RequestMethod.ALL }],
      }),
    }),

    ThrottlerModule.forRoot(throttlerConfig),
    ScheduleModule.forRoot(),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        buildTypeOrmConfig(configService),
    }),

    TypeOrmModule.forFeature([User, Project, ProjectAssignment, Delivery]),

    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        buildBullConfig(configService),
    }),

    DockerInfrastructureModule,
    AiModule,
  ],
  providers: [RedisClientService, AdminSeedService, DemoSeedService],
  exports: [RedisClientService, DockerInfrastructureModule, AiModule],
})
export class InfrastructureModule {}
