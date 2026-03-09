/**
 * @fileoverview Users Service - Gestion Central de Identidades.
 *
 * ============================================================================
 * ARQUITECTURA DEL MODULO DE IDENTIDAD
 * ============================================================================
 *
 * Este servicio opera como la capa de datos fundacional para la gestion de
 * identidades. Proporcionamos la logica de negocio para operaciones CRUD sobre
 * la entidad de usuario y control de acceso.
 *
 * Responsabilidades:
 * - Aprovisionamiento seguro de identidades y persistencia.
 * - Hashing criptografico de credenciales mediante bcrypt.
 * - Recuperacion estructurada de datos para flujos de autenticacion.
 * - Sanitizacion de datos (PII Prevention) en los limites del sistema.
 * - Paginacion/filtrado/ordenamiento para evitar respuestas masivas no escalables.
 *
 * @module UsersService
 * @requires @nestjs/common
 * @requires typeorm
 * @requires bcrypt
 * @version 1.3.0 - Escalabilidad de listados con paginacion y filtros.
 */

import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserStatus } from './entities/user.entity';
import { CreateUserDto, UpdateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';

/** Parametro de Seguridad: Factor de trabajo de bcrypt. Minimo 10 recomendado para produccion. */
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
  ) {}

  /**
   * Recuperamos una identidad de usuario por email para la verificacion de autenticacion.
   *
   * @param {string} email - Cadena de direccion de email normalizada.
   * @param {boolean} includeDeleted - Flag para incluir registros en estado 'Soft Delete'.
   * @returns {Promise<User | null>} Entidad User incluyendo el passwordHash para validacion, o null.
   */
  async findByEmail(
    email: string,
    includeDeleted = false,
  ): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email },
      withDeleted: includeDeleted,
    });
  }

  /**
   * Recuperamos una identidad de usuario por su UUID.
   *
   * @param {string} id - Cadena UUID v4 valida.
   * @param {boolean} includeDeleted - Flag para incluir registros en estado 'Soft Delete'.
   * @returns {Promise<User | null>} Entidad User, o null.
   */
  async findById(id: string, includeDeleted = false): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { id },
      withDeleted: includeDeleted,
    });
  }

  /**
   * Recuperamos la lista completa de identidades.
   * Aviso Interno: En un futuro, para miles de registros, esta operacion
   * cruda representa un riesgo de escalabilidad y debera volver a incluir
   * fragmentación controlada.
   *
   * @returns {Promise<Omit<User, 'passwordHash'>[]>} Data de todos los usuarios sanitizada.
   */
  async findAll(): Promise<Omit<User, 'passwordHash'>[]> {
    const users = await this.usersRepository.find();
    return users.map((user) => this.sanitizeUser(user));
  }

  /**
   * Aprovisionamos una nueva identidad de usuario en la base de datos (Uso Interno).
   *
   * @param {string} email - Direccion de correo electronico validada.
   * @param {string} password - Contrasena en texto plano (sera hasheada criptograficamente).
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
    const existingUser = await this.findByEmail(dto.email, true);
    if (existingUser) {
      throw new ConflictException('El email ya esta registrado.');
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
  async update(
    id: string,
    dto: UpdateUserDto,
  ): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    if (dto.email !== undefined && dto.email !== user.email) {
      const existingUser = await this.findByEmail(dto.email, true);
      if (existingUser) {
        throw new ConflictException(
          'El email ya esta registrado por otro usuario.',
        );
      }
      user.email = dto.email;
    }

    if (dto.firstName !== undefined) user.firstName = dto.firstName;
    if (dto.lastName !== undefined) user.lastName = dto.lastName;
    if (dto.role !== undefined) user.role = dto.role;
    if (dto.status !== undefined) user.status = dto.status;

    if (dto.password !== undefined) {
      user.passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);
    }

    const updatedUser = await this.usersRepository.save(user);
    return this.sanitizeUser(updatedUser);
  }

  /**
   * Ejecutamos un borrado logico (Soft Delete) de la identidad.
   * El registro permanece en la BD con deletedAt poblado para auditoria.
   *
   * @param {string} id - UUID del usuario.
   * @returns {Promise<{ message: string }>} Confirmacion de la operacion.
   */
  async remove(id: string): Promise<{ message: string }> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado para borrado logico.');
    }
    await this.usersRepository.softRemove(user);
    return { message: 'Identidad marcada como eliminada correctamente.' };
  }

  /**
   * Restauramos una identidad previamente eliminada logicamente.
   *
   * @param {string} id - UUID del usuario a recuperar.
   * @returns {Promise<Omit<User, 'passwordHash'>>} Usuario restaurado sanitizado.
   */
  async restore(id: string): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.findById(id, true);
    if (!user) {
      throw new NotFoundException(
        'No se encontro una identidad eliminada con ese ID.',
      );
    }

    if (!user.deletedAt) {
      throw new ConflictException('La identidad ya se encuentra activa.');
    }

    await this.usersRepository.recover(user);

    const restoredUser = await this.findById(id);
    if (!restoredUser) {
      throw new NotFoundException(
        'No se pudo restaurar la identidad solicitada.',
      );
    }

    return this.sanitizeUser(restoredUser);
  }

  /**
   * Mutacion forzada del estado de la cuenta (Gestion de Ciclo de Vida).
   *
   * @param {string} id - UUID del usuario.
   * @param {UserStatus} status - Nuevo estado objetivo.
   * @returns {Promise<Omit<User, 'passwordHash'>>} Usuario con estado actualizado.
   */
  async updateStatus(
    id: string,
    status: UserStatus,
  ): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException(
        'Usuario no encontrado para cambio de estado.',
      );
    }

    user.status = status;
    const updatedUser = await this.usersRepository.save(user);
    return this.sanitizeUser(updatedUser);
  }

  /**
   * Verificamos criptograficamente una contrasena en texto claro contra un hash almacenado.
   *
   * @param {User} user - Entidad del usuario objetivo.
   * @param {string} password - Contrasena en texto claro provista.
   * @returns {Promise<boolean>} Booleano indicando validacion exitosa.
   */
  async validatePassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.passwordHash);
  }

  /**
   * Validamos que una identidad se encuentre activa y habilitada para autenticacion.
   *
   * @param {User | null} user - Entidad de usuario obtenida desde persistencia.
   * @param {string} unauthorizedMessage - Mensaje homogeneo para denegar acceso.
   * @returns {User} Entidad validada y apta para emision/uso de sesion.
   * @throws {UnauthorizedException} Si la identidad esta ausente, suspendida o eliminada.
   */
  assertAccountIsActive(
    user: User | null,
    unauthorizedMessage = 'Credenciales invalidas proporcionadas.',
  ): User {
    const isSoftDeleted =
      user?.deletedAt !== undefined && user?.deletedAt !== null;
    const isInactive = user?.status !== UserStatus.ACTIVE;

    if (!user || isSoftDeleted || isInactive) {
      throw new UnauthorizedException(unauthorizedMessage);
    }

    return user;
  }

  /**
   * Sanitizador de datos: Extraemos credenciales sensibles del objeto de usuario.
   *
   * @param {User} user - Entidad de usuario cruda (raw).
   * @returns {Omit<User, 'passwordHash'>} Objeto de usuario sanitizado.
   */
  sanitizeUser(user: User): Omit<User, 'passwordHash'> {
    const sanitized = { ...user } as Omit<User, 'passwordHash'> & {
      passwordHash?: string;
    };
    delete sanitized.passwordHash;
    return sanitized;
  }
}
