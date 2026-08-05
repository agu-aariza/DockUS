/**
 * @fileoverview Puerto de persistencia de `User`
 * (user.repository.interface).
 *
 * @module user.repository.interface
 */

import { User, UserRole, UserStatus } from '../../entities/user.entity';
import type { UserSortField } from '../../dto/list-users-query.dto';
import type { SortOrder } from '../../../../shared/dto/paginated-query.dto';

/**
 * Puerto de persistencia consumido por la aplicación sin exponer tipos de
 * TypeORM. Los seeders de `shared/` pueden usar el repositorio concreto como
 * excepción controlada fuera de este contrato.
 */
export const USER_REPOSITORY = Symbol('IUserRepository');

/** Campos aceptados por `Repository.create()` — construcción en memoria, sin persistir. */
export interface NewUserData {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role?: UserRole;
  status?: UserStatus;
}

export interface UserListQuery {
  role?: UserRole;
  status?: UserStatus;
  search?: string;
  sortBy: UserSortField;
  sortOrder: SortOrder;
  page: number;
  limit: number;
}

export interface UserListPage {
  data: User[];
  total: number;
}

export interface IUserRepository {
  /** Búsqueda plana por ID. `passwordHash` nunca viaja (columna `select: false`). */
  findById(id: string, includeDeleted?: boolean): Promise<User | null>;

  /** Búsqueda plana por email normalizado. */
  findByEmail(email: string, includeDeleted?: boolean): Promise<User | null>;

  /**
   * Igual que `findByEmail`, pero incluye `passwordHash` explícitamente.
   * Reservado al flujo de autenticación (`AuthService`/`findByEmailForAuth`).
   */
  findByEmailWithPasswordHash(
    email: string,
    includeDeleted?: boolean,
  ): Promise<User | null>;

  /** Búsqueda plana por ID, restringida a un rol concreto (p. ej. expediente de alumno). */
  findByIdAndRole(id: string, role: UserRole): Promise<User | null>;

  /** Usuarios cuyo ID esté en la lista, sin restricción de rol. */
  findByIds(ids: string[]): Promise<User[]>;

  /** Usuarios cuyo email esté en la lista, opcionalmente restringido a un rol. */
  findByEmails(emails: string[], role?: UserRole): Promise<User[]>;

  /** Usuarios que casan nombre y apellido exactos, restringido a un rol. */
  findByNameAndRole(
    firstName: string,
    lastName: string,
    role: UserRole,
  ): Promise<User[]>;

  /** Listado paginado, filtrable por rol/estado/búsqueda libre y ordenable. */
  findPaginated(query: UserListQuery): Promise<UserListPage>;

  /** Construye la entidad en memoria, sin persistir (paridad con `Repository.create`). */
  create(data: NewUserData): User;

  save(user: User): Promise<User>;
  softRemove(user: User): Promise<User>;
  recover(user: User): Promise<User>;
}
