/**
 * @fileoverview Users Service - Gestión Central de Identidades.
 * 
 * ============================================================================
 * ARQUITECTURA DEL MODULO DE IDENTIDAD
 * ============================================================================
 * 
 * Este servicio opera como la capa de datos fundacional para la gestión de 
 * identidades. En la iteración arquitectónica actual, las operaciones CRUD 
 * RESTful directas para la entidad de usuario han sido explícitamente 
 * eliminadas para imponer un perímetro de seguridad estricto. Todas las 
 * peticiones de mutación de usuarios DEBEN ser enrutadas a través del AuthModule.
 * 
 * Responsabilidades (Core Responsibilities):
 * - Aprovisionamos identidades de usuario de forma segura
 * - Hasheamos criptográficamente las contraseñas (bcrypt)
 * - Recuperamos los datos de manera estructurada para flujos de autenticación
 * - Sanitizamos los datos (eliminación de PII/credenciales) antes de 
 *   cruzar los límites del sistema (boundary crossing)
 * 
 * @module UsersService
 * @requires @nestjs/common
 * @requires typeorm
 * @requires bcrypt
 * @version 1.1.0
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import * as bcrypt from 'bcrypt';

/** Parámetro de Seguridad: Factor de trabajo de bcrypt. Mínimo 10 recomendado para producción. */
const BCRYPT_SALT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) { }

  /**
   * Recuperamos una identidad de usuario por email para la verificación de autenticación.
   * 
   * @param email - Cadena de dirección de email normalizada
   * @returns Entidad User incluyendo el passwordHash para validación, o null
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  /**
   * Recuperamos una identidad de usuario por su UUID.
   * 
   * @param id - Cadena UUID v4 válida
   * @returns Entidad User, o null
   */
  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  /**
   * Aprovisionamos una nueva identidad de usuario en la base de datos.
   * Nota: Este es un método interno llamado exclusivamente por AuthService.
   * 
   * @param email - Dirección de correo electrónico validada
   * @param password - Contraseña en texto plano (será hasheada criptográficamente)
   * @param firstName - Nombre del usuario
   * @param lastName - Apellido del usuario
   * @returns La nueva entidad de User aprovisionada
   */
  async create(
    email: string,
    password: string,
    firstName: string,
    lastName: string,
  ): Promise<User> {
    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    const user = this.usersRepository.create({
      email,
      passwordHash,
      firstName,
      lastName,
    });
    return this.usersRepository.save(user);
  }

  /**
   * Verificamos criptográficamente una contraseña en texto claro contra un hash almacenado.
   * Utilizamos una comparación de tiempo constante para prevenir ataques de tiempo (timing attacks).
   * 
   * @param user - Entidad del usuario objetivo que contiene el hash
   * @param password - Contraseña en texto claro provista
   * @returns Booleano indicando validación exitosa
   */
  async validatePassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.passwordHash);
  }

  /**
   * Sanitizador de datos: Extraemos credenciales sensibles del objeto de usuario.
   * DEBE ser invocado antes de devolver datos de identidad a través de los 
   * límites del sistema.
   * 
   * @param user - Entidad de usuario cruda (raw)
   * @returns Objeto de usuario sanitizado y seguro para consumo externo
   */
  sanitizeUser(user: User): Omit<User, 'passwordHash'> {
    const { passwordHash, ...sanitized } = user;
    return sanitized;
  }
}
