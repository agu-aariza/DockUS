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
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { envValidationSchema } from '../config/env.validation';
import { CacheModule } from './cache/cache.module';
import { buildTypeOrmConfig } from './database/typeorm.config';
import { buildPinoHttpConfig } from '../config/logger.config';
import {
  buildBullConfig,
  buildRedisConnectionOptions,
} from '../config/redis.config';
import { throttlerConfig } from './security/throttler.config';
import { EduCodeAIThrottlerGuard } from './security/educodeai-throttler.guard';
import { AdminSeedService } from './seed/admin-seed.service';
import { DemoSeedService } from './seed/demo-seed.service';
import { User } from '../../modules/users/entities/user.entity';
import { Project } from '../../modules/projects/entities/project.entity';
import { ProjectAssignment } from '../../modules/projects/assignments/entities/project-assignment.entity';
import { Delivery } from '../../modules/projects/deliveries/entities/delivery.entity';

import { DockerInfrastructureModule } from './docker/docker-infrastructure.module';
import { AiModule } from './ai/ai.module';
import { StorageInfrastructureModule } from './storage/storage-infrastructure.module';

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

    // Almacenamiento compartido en Redis: con el contador en memoria
    // del proceso, cada réplica de API llevaba su propia cuenta y el límite
    // efectivo se multiplicaba por el número de instancias.
    //
    // Se usa `buildRedisConnectionOptions` y NO la conexión de
    // `RedisClientService`: esa está tuneada con `enableOfflineQueue: false`
    // para fallar rápido en las sondas de salud, y con ella un corte breve de
    // Redis haría fallar peticiones legítimas en lugar de contarlas.
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: throttlerConfig,
        storage: new ThrottlerStorageRedisService(
          buildRedisConnectionOptions(configService),
        ),
      }),
    }),
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
    CacheModule,
    StorageInfrastructureModule,
  ],
  providers: [AdminSeedService, DemoSeedService, EduCodeAIThrottlerGuard],
  exports: [
    CacheModule,
    DockerInfrastructureModule,
    AiModule,
    StorageInfrastructureModule,
    EduCodeAIThrottlerGuard,
  ],
})
export class InfrastructureModule {}
