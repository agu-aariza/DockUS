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
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
  // `CacheModule` da acceso a la caché de identidad: toda mutación de una
  // cuenta debe invalidarla, o la sesión seguiría operando con el rol y el
  // estado anteriores hasta que venciera el TTL (ESC-ALTO-04).
  imports: [TypeOrmModule.forFeature([User]), CacheModule],
  controllers: [UsersController], // Habilitamos la gestión administrativa via API
  providers: [UsersService],
  exports: [UsersService], // Exportado para inyección de dependencias en AuthModule
})
export class UsersModule {}
