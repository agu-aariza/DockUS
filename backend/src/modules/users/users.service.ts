/**
 * @fileoverview Servicio de negocio para gestión de usuarios.
 *
 * Contexto:
 * - Implementa altas, consultas, actualización y baja lógica.
 * - Incluye hashing de contraseña y reglas de consistencia.
 *
 * @module UsersService
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
import { ListUsersQueryDto, UserSortField } from './dto/list-users-query.dto';
import * as bcrypt from 'bcrypt';
import {
  buildPaginationMeta,
  PaginationMeta,
} from '../../shared/utils/pagination.util';
import { throwIfUniqueViolation } from '../../shared/database/unique-violation.util';

const BCRYPT_SALT_ROUNDS = 10;
const USER_SORT_COLUMNS: Record<UserSortField, string> = {
  createdAt: 'user.createdAt',
  updatedAt: 'user.updatedAt',
  email: 'user.email',
  firstName: 'user.firstName',
  lastName: 'user.lastName',
  role: 'user.role',
  status: 'user.status',
};

export interface PaginatedUsersResponse {
  data: Omit<User, 'passwordHash'>[];
  meta: PaginationMeta;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  /**
   * Busca un usuario por email sin incluir secretos por defecto.
   */
  async findByEmail(
    email: string,
    includeDeleted = false,
  ): Promise<User | null> {
    const normalizedEmail = this.normalizeEmail(email);
    return this.usersRepository.findOne({
      where: { email: normalizedEmail },
      withDeleted: includeDeleted,
    });
  }

  /**
   * Busca un usuario por email incluyendo explícitamente el hash de contraseña.
   *
   * Este método queda reservado al flujo de autenticación.
   */
  async findByEmailForAuth(
    email: string,
    includeDeleted = false,
  ): Promise<User | null> {
    const normalizedEmail = this.normalizeEmail(email);
    const queryBuilder = this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email: normalizedEmail });

    if (includeDeleted) {
      queryBuilder.withDeleted();
    }

    return queryBuilder.getOne();
  }

  /**
   * Busca una identidad por UUID.
   */
  async findById(id: string, includeDeleted = false): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { id },
      withDeleted: includeDeleted,
    });
  }

  /**
   * Lista usuarios de forma paginada, filtrable y ordenada.
   */
  async findAll(query: ListUsersQueryDto): Promise<PaginatedUsersResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim();
    const sortBy = query.sortBy ?? 'lastName';
    const sortOrder = query.sortOrder ?? 'ASC';

    const queryBuilder = this.usersRepository.createQueryBuilder('user');

    if (query.role) {
      queryBuilder.andWhere('user.role = :role', { role: query.role });
    }

    if (query.status) {
      queryBuilder.andWhere('user.status = :status', { status: query.status });
    }

    if (search) {
      queryBuilder.andWhere(
        '(user.email ILIKE :search OR user.firstName ILIKE :search OR user.lastName ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    queryBuilder
      .orderBy(USER_SORT_COLUMNS[sortBy], sortOrder)
      .skip((page - 1) * limit)
      .take(limit);

    const [users, total] = await queryBuilder.getManyAndCount();

    return {
      data: users.map((user) => this.sanitizeUser(user)),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  /**
   * Crea un usuario para flujos internos.
   *
   * El email permanece reservado incluso si existe un soft delete previo.
   */
  async create(
    email: string,
    password: string,
    firstName: string,
    lastName: string,
  ): Promise<User> {
    const normalizedEmail = this.normalizeEmail(email);
    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    const user = this.usersRepository.create({
      email: normalizedEmail,
      passwordHash,
      firstName,
      lastName,
    });

    try {
      return await this.usersRepository.save(user);
    } catch (error) {
      throwIfUniqueViolation(error, 'El email ya esta registrado.');
    }
  }

  /**
   * Crea un usuario a partir de un DTO administrativo.
   */
  async createFromDto(dto: CreateUserDto): Promise<Omit<User, 'passwordHash'>> {
    const normalizedEmail = this.normalizeEmail(dto.email);
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);
    const user = this.usersRepository.create({
      email: normalizedEmail,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: dto.role,
      status: dto.status,
      passwordHash,
    });

    let savedUser: User;
    try {
      savedUser = await this.usersRepository.save(user);
    } catch (error) {
      throwIfUniqueViolation(error, 'El email ya esta registrado.');
    }

    return this.sanitizeUser(savedUser);
  }

  /**
   * Actualiza parcialmente una identidad existente.
   */
  async update(
    id: string,
    dto: UpdateUserDto,
  ): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    if (dto.email !== undefined) {
      const normalizedEmail = this.normalizeEmail(dto.email);
      const normalizedCurrentEmail = this.normalizeEmail(user.email);

      if (normalizedEmail !== normalizedCurrentEmail) {
        const existingUser = await this.findByEmail(normalizedEmail, true);
        if (existingUser) {
          throw new ConflictException(
            'El email ya esta registrado por otro usuario.',
          );
        }
      }

      user.email = normalizedEmail;
    }

    if (dto.firstName !== undefined) user.firstName = dto.firstName;
    if (dto.lastName !== undefined) user.lastName = dto.lastName;
    if (dto.role !== undefined) user.role = dto.role;
    if (dto.status !== undefined) user.status = dto.status;

    if (dto.password !== undefined) {
      user.passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);
    }

    let updatedUser: User;
    try {
      updatedUser = await this.usersRepository.save(user);
    } catch (error) {
      throwIfUniqueViolation(
        error,
        'El email ya esta registrado por otro usuario.',
      );
    }

    return this.sanitizeUser(updatedUser);
  }

  /**
   * Aplica un borrado lógico sobre la identidad.
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
   * Restaura una identidad eliminada lógicamente.
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
   * Cambia el estado operativo de una cuenta.
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
   * Compara una contraseña en texto claro contra un hash almacenado.
   */
  async validatePassword(
    password: string,
    passwordHash: string,
  ): Promise<boolean> {
    return bcrypt.compare(password, passwordHash);
  }

  /**
   * Valida que una identidad siga activa para autenticar o autorizar.
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
   * Elimina datos sensibles antes de devolver un usuario fuera del dominio.
   */
  sanitizeUser(user: User): Omit<User, 'passwordHash'> {
    const sanitized = { ...user } as Omit<User, 'passwordHash'> & {
      passwordHash?: string;
    };
    delete sanitized.passwordHash;
    return sanitized;
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}
