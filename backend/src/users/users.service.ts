/**
 * @fileoverview Users Service - Gestión Central de Identidades.
 * 
 * ============================================================================
 * ARQUITECTURA DEL MODULO DE IDENTIDAD
 * ============================================================================
 * 
 * Este servicio opera como la capa de datos fundacional para la gestión de 
 * identidades. Proporcionamos la lógica de negocio para operaciones CRUD sobre 
 * la entidad de usuario y control de acceso.
 * 
 * Responsabilidades (Core Responsibilities):
 * - Aprovisionamos identidades de usuario de forma segura.
 * - Hasheamos criptográficamente las contraseñas (bcrypt).
 * - Recuperamos los datos de manera estructurada para flujos de autenticación.
 * - Sanitizamos los datos (eliminación de PII/credenciales) antes de 
 *   cruzar los límites del sistema (boundary crossing).
 * 
 * @module UsersService
 * @requires @nestjs/common
 * @requires typeorm
 * @requires bcrypt
 * @version 1.2.0 - Restauración de operaciones CRUD completas.
 */

import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto, UpdateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';

/** Parámetro de Seguridad: Factor de trabajo de bcrypt. Mínimo 10 recomendado para producción. */
const BCRYPT_SALT_ROUNDS = 10;

@Injectable()
export class UsersService {
  /**
   * Inyectamos el repositorio de usuarios de TypeORM.
   * @param {Repository<User>} usersRepository - Orquestador de persistencia de usuarios.
   */
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) { }

  /**
   * Recuperamos una identidad de usuario por email para la verificación de autenticación.
   * 
   * @param {string} email - Cadena de dirección de email normalizada.
   * @returns {Promise<User | null>} Entidad User incluyendo el passwordHash para validación, o null.
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  /**
   * Recuperamos una identidad de usuario por su UUID.
   * 
   * @param {string} id - Cadena UUID v4 válida.
   * @returns {Promise<User | null>} Entidad User, o null.
   */
  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  /**
   * Recuperamos todas las identidades registradas en el sistema.
   * 
   * @returns {Promise<Omit<User, 'passwordHash'>[]>} Lista de usuarios sanitizados.
   */
  async findAll(): Promise<Omit<User, 'passwordHash'>[]> {
    const users = await this.usersRepository.find();
    return users.map((user) => this.sanitizeUser(user));
  }

  /**
   * Aprovisionamos una nueva identidad de usuario en la base de datos (Uso Interno).
   * 
   * @param {string} email - Dirección de correo electrónico validada.
   * @param {string} password - Contraseña en texto plano (será hasheada criptográficamente).
   * @param {string} firstName - Nombre del usuario.
   * @param {string} lastName - Apellido del usuario.
   * @returns {Promise<User>} La nueva entidad de User aprovisionada.
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
   * Aprovisionamos una nueva identidad de usuario a partir de un DTO (Uso Externo API).
   * 
   * @param {CreateUserDto} dto - Datos estructurados del nuevo usuario.
   * @returns {Promise<Omit<User, 'passwordHash'>>} Usuario creado sanitizado.
   */
  async createFromDto(dto: CreateUserDto): Promise<Omit<User, 'passwordHash'>> {
    const existingUser = await this.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('El email ya está registrado.');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);
    const user = this.usersRepository.create({
      ...dto,
      passwordHash,
    });
    const savedUser = await this.usersRepository.save(user);
    return this.sanitizeUser(savedUser);
  }

  /**
   * Actualizamos parcialmente una identidad existente.
   * 
   * @param {string} id - UUID del usuario.
   * @param {UpdateUserDto} dto - Campos a modificar.
   * @returns {Promise<Omit<User, 'passwordHash'>>} Usuario actualizado sanitizado.
   */
  async update(id: string, dto: UpdateUserDto): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    if (dto.email && dto.email !== user.email) {
      const existingUser = await this.findByEmail(dto.email);
      if (existingUser) {
        throw new ConflictException('El email ya está registrado por otro usuario.');
      }
      user.email = dto.email;
    }

    if (dto.firstName) user.firstName = dto.firstName;
    if (dto.lastName) user.lastName = dto.lastName;
    if (dto.role) user.role = dto.role;

    if (dto.password) {
      user.passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);
    }

    const updatedUser = await this.usersRepository.save(user);
    return this.sanitizeUser(updatedUser);
  }

  /**
   * Eliminamos una identidad de forma física permanente.
   * 
   * @param {string} id - UUID del usuario.
   * @returns {Promise<{ message: string }>} Confirmación de la operación.
   */
  async remove(id: string): Promise<{ message: string }> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado.');
    }
    await this.usersRepository.remove(user);
    return { message: 'Usuario eliminado correctamente.' };
  }

  /**
   * Verificamos criptográficamente una contraseña en texto claro contra un hash almacenado.
   * 
   * @param {User} user - Entidad del usuario objetivo.
   * @param {string} password - Contraseña en texto claro provista.
   * @returns {Promise<boolean>} Booleano indicando validación exitosa.
   */
  async validatePassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.passwordHash);
  }

  /**
   * Sanitizador de datos: Extraemos credenciales sensibles del objeto de usuario.
   * 
   * @param {User} user - Entidad de usuario cruda (raw).
   * @returns {Omit<User, 'passwordHash'>} Objeto de usuario sanitizado.
   */
  sanitizeUser(user: User): Omit<User, 'passwordHash'> {
    const { passwordHash, ...sanitized } = user;
    return sanitized;
  }
}
