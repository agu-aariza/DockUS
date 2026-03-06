/**
 * @fileoverview Users Module Configuration - Configuración del Módulo de Usuarios.
 * 
 * ============================================================================
 * CONFIGURACION DEL MODULO DE IDENTIDAD
 * ============================================================================
 * 
 * Definimos el contexto de inyección de dependencias para la capa de Identidad.
 * 
 * Nota de Arquitectura: Hemos eliminado UsersController del array de 
 * controladores para deshabilitar el acceso directo vía API REST y forzar 
 * estrictos límites de seguridad perimetral. Todo acceso debe pasar por Auth.
 * 
 * @module UsersModule
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [], // Acceso REST directo deshabilitado por seguridad integral
  providers: [UsersService],
  exports: [UsersService], // Exportado para inyección de dependencias en AuthModule
})
export class UsersModule { }
