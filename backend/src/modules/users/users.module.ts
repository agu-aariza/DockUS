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
import { User } from './entities/user.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController], // Habilitamos la gestión administrativa via API
  providers: [UsersService],
  exports: [UsersService], // Exportado para inyección de dependencias en AuthModule
})
export class UsersModule {}
