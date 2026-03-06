/**
 * @fileoverview Users Module Configuration - Configuración del Módulo de Usuarios.
 * 
 * ============================================================================
 * CONFIGURACION DEL MODULO DE IDENTIDAD
 * ============================================================================
 * 
 * Definimos el contexto de inyección de dependencias para la capa de Identidad.
 * Registramos el controlador para permitir la gestión administrativa y exportamos
 * el servicio para la validación de sesiones en el módulo de autenticación.
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
export class UsersModule { }
