/**
 * @fileoverview Módulo de identidad y administración de usuarios.
 *
 * Contexto:
 * - Registra entidad, servicio y controlador del dominio users.
 * - Exporta UsersService para consumo en auth.
 *
 * @module UsersModule
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '../../shared/infrastructure/cache/cache.module';
import { User } from './entities/user.entity';
import { UsersService } from './application/users.service';
import { UsersController } from './presentation/users.controller';
import { UserRepository } from './infrastructure/database/user.repository';
import { USER_REPOSITORY } from './domain/repositories/user.repository.interface';

@Module({
  // `CacheModule` da acceso a la caché de identidad: toda mutación de una
  // cuenta debe invalidarla, o la sesión seguiría operando con el rol y el
  // estado anteriores hasta que venciera el TTL.
  imports: [TypeOrmModule.forFeature([User]), CacheModule],
  controllers: [UsersController], // Habilitamos la gestión administrativa via API
  providers: [
    UsersService,
    {
      provide: USER_REPOSITORY,
      useClass: UserRepository,
    },
  ],
  // USER_REPOSITORY exportado para ProjectsModule/AcademicModule: el
  // puerto se registra una vez, aquí, y los consumidores importan este módulo
  // en vez de volver a declarar el `provide`.
  exports: [UsersService, USER_REPOSITORY],
})
export class UsersModule {}
