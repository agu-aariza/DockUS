/**
 * @fileoverview Pruebas unitarias del servicio de usuarios.
 *
 * Contexto:
 * - Valida normalización de email y manejo de conflictos de BD.
 * - Cubre listado paginado y ciclo de vida de cuenta.
 *
 * @module UsersServiceSpec
 */

import { ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { UsersService } from './users.service';
import { CreateUserDto } from '../dto/create-user.dto';
import { User, UserRole, UserStatus } from '../entities/user.entity';
import type { IUserRepository } from '../domain/repositories/user.repository.interface';

const buildUser = (overrides: Partial<User> = {}): User => ({
  id: '2e141a4d-e163-43f8-87f8-75afee5e2f85',
  email: 'user@educodeai.com',
  passwordHash: 'hashed-password',
  role: UserRole.STUDENT,
  status: UserStatus.ACTIVE,
  firstName: 'User',
  lastName: 'EduCodeAI',
  createdAt: new Date('2026-03-09T00:00:00.000Z'),
  updatedAt: new Date('2026-03-09T00:00:00.000Z'),
  deletedAt: undefined as unknown as Date,
  assignedProjects: [],
  ...overrides,
});

describe('UsersService', () => {
  let service: UsersService;

  const usersRepository = {
    findById: jest.fn(),
    findByEmail: jest.fn(),
    findByEmailWithPasswordHash: jest.fn(),
    findPaginated: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    softRemove: jest.fn(),
    recover: jest.fn(),
  };

  const authIdentityCache = {
    invalidate: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UsersService(
      usersRepository as unknown as IUserRepository,
      authIdentityCache as never,
    );
  });

  it('debe normalizar email en findByEmail antes de consultar', async () => {
    usersRepository.findByEmail.mockResolvedValue(null);

    await service.findByEmail('  TeSt@EduCodeAI.com  ', true);

    expect(usersRepository.findByEmail).toHaveBeenCalledWith(
      'test@educodeai.com',
      true,
    );
  });

  it('debe cargar passwordHash solo en el lookup explícito de autenticación', async () => {
    const user = buildUser({ email: 'secure@educodeai.com' });
    usersRepository.findByEmailWithPasswordHash.mockResolvedValue(user);

    const result = await service.findByEmailForAuth(
      '  Secure@EduCodeAI.com  ',
      true,
    );

    expect(usersRepository.findByEmailWithPasswordHash).toHaveBeenCalledWith(
      'secure@educodeai.com',
      true,
    );
    expect(result).toBe(user);
  });

  it('debe normalizar email al crear usuarios internamente', async () => {
    const savedUser = buildUser({ email: 'test@educodeai.com' });
    usersRepository.save.mockResolvedValue(savedUser);

    await service.create(
      '  TeSt@EduCodeAI.com  ',
      'password123',
      'Test',
      'User',
    );

    expect(usersRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'test@educodeai.com',
      }),
    );
  });

  it('debe traducir error de unicidad de BD a ConflictException al crear usuario', async () => {
    const dto: CreateUserDto = {
      email: 'existing@educodeai.com',
      password: 'password123',
      firstName: 'Existing',
      lastName: 'User',
    };
    const uniqueViolation = new QueryFailedError('INSERT INTO users', [], {
      code: '23505',
    } as any);
    usersRepository.save.mockRejectedValue(uniqueViolation);

    await expect(service.createFromDto(dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(usersRepository.findByEmail).not.toHaveBeenCalled();
    expect(usersRepository.save).toHaveBeenCalled();
  });

  it('debe devolver un listado paginado con metadatos y usuarios sanitizados', async () => {
    const users = [
      buildUser({
        id: '0f4f2a18-bb0d-46df-a4f1-7220f3d63021',
        email: 'teacher@educodeai.com',
        role: UserRole.TEACHER,
      }),
      buildUser({
        id: 'fc0336bf-f1bf-4df7-88f8-86df0251f6ec',
        email: 'teacher2@educodeai.com',
        role: UserRole.TEACHER,
      }),
    ];
    usersRepository.findPaginated.mockResolvedValue({ data: users, total: 2 });

    const result = await service.findAll({
      page: 1,
      limit: 20,
      sortBy: 'createdAt',
      sortOrder: 'DESC',
    });

    expect(usersRepository.findPaginated).toHaveBeenCalledWith({
      role: undefined,
      status: undefined,
      search: undefined,
      sortBy: 'createdAt',
      sortOrder: 'DESC',
      page: 1,
      limit: 20,
    });
    expect(result.data).toHaveLength(2);
    expect(result.data[0].email).toBe('teacher@educodeai.com');
    expect(
      (result.data[0] as { passwordHash?: string }).passwordHash,
    ).toBeUndefined();
    expect(result.meta).toEqual({
      page: 1,
      limit: 20,
      total: 2,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false,
    });
  });

  it('debe aplicar filtros y orden seguro en el listado', async () => {
    usersRepository.findPaginated.mockResolvedValue({ data: [], total: 0 });

    await service.findAll({
      page: 2,
      limit: 10,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      search: 'dock',
      sortBy: 'email',
      sortOrder: 'ASC',
    });

    expect(usersRepository.findPaginated).toHaveBeenCalledWith({
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      search: 'dock',
      sortBy: 'email',
      sortOrder: 'ASC',
      page: 2,
      limit: 10,
    });
  });

  it('debe normalizar email en update antes de persistir', async () => {
    const existing = buildUser({
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'existing@educodeai.com',
    });
    const updated = buildUser({
      id: existing.id,
      email: 'new.email@educodeai.com',
    });

    usersRepository.findById.mockResolvedValue(existing);
    usersRepository.findByEmail.mockResolvedValue(null);
    usersRepository.save.mockResolvedValue(updated);

    const result = await service.update(existing.id, {
      email: '  New.Email@EduCodeAI.com  ',
    });

    expect(usersRepository.findByEmail).toHaveBeenCalledWith(
      'new.email@educodeai.com',
      true,
    );
    expect(usersRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: existing.id,
        email: 'new.email@educodeai.com',
      }),
    );
    expect(result.email).toBe('new.email@educodeai.com');
  });

  it('debe aplicar soft delete al eliminar identidad', async () => {
    const user = buildUser();

    usersRepository.findById.mockResolvedValue(user);
    usersRepository.softRemove.mockResolvedValue(user);

    const result = await service.remove(user.id);

    expect(usersRepository.findById).toHaveBeenCalledWith(user.id, false);
    expect(usersRepository.softRemove).toHaveBeenCalledWith(user);
    expect(result).toEqual({
      message: 'Identidad marcada como eliminada correctamente.',
    });
  });

  it('debe restaurar identidad y devolver el registro recargado sin passwordHash', async () => {
    const deletedUser = buildUser({
      deletedAt: new Date('2026-03-08T00:00:00.000Z'),
    });
    const restoredUser = buildUser({
      deletedAt: undefined as unknown as Date,
    });

    usersRepository.findById
      .mockResolvedValueOnce(deletedUser)
      .mockResolvedValueOnce(restoredUser);
    usersRepository.recover.mockResolvedValue(restoredUser);

    const result = await service.restore(deletedUser.id);

    expect(usersRepository.findById).toHaveBeenNthCalledWith(
      1,
      deletedUser.id,
      true,
    );
    expect(usersRepository.recover).toHaveBeenCalledWith(deletedUser);
    expect(usersRepository.findById).toHaveBeenNthCalledWith(
      2,
      deletedUser.id,
      false,
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: restoredUser.id,
        email: restoredUser.email,
        status: restoredUser.status,
      }),
    );
    expect((result as { passwordHash?: string }).passwordHash).toBeUndefined();
  });

  it('debe actualizar estado de cuenta y responder usuario sanitizado', async () => {
    const user = buildUser();
    const updatedUser = buildUser({ status: UserStatus.SUSPENDED });

    usersRepository.findById.mockResolvedValue(user);
    usersRepository.save.mockResolvedValue(updatedUser);

    const result = await service.updateStatus(user.id, UserStatus.SUSPENDED);

    expect(usersRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: user.id,
        status: UserStatus.SUSPENDED,
      }),
    );
    expect(result.status).toBe(UserStatus.SUSPENDED);
    expect((result as { passwordHash?: string }).passwordHash).toBeUndefined();
  });

  it('debe validar contraseñas usando el hash provisto explícitamente', async () => {
    await expect(
      service.validatePassword('plain-password', 'hashed-password'),
    ).resolves.toBe(false);
  });

  /**
   * El riesgo de la caché de identidad no está en la caché sino en
   * la invalidación: un solo punto de mutación que la olvide deja operando con
   * el rol o el estado anteriores a una cuenta ya modificada, que es justo lo
   * que la recarga por petición existía para impedir.
   *
   * Si se añade un método que mute rol, estado o borrado lógico, hay que
   * añadirlo también a esta tabla.
   */
  describe('invalidación de la caché de identidad', () => {
    const user = buildUser();

    it.each([
      [
        'update',
        () => {
          usersRepository.findById.mockResolvedValue(user);
          usersRepository.save.mockResolvedValue(user);
          return service.update(user.id, { firstName: 'Nombre' });
        },
      ],
      [
        'remove (baja lógica)',
        () => {
          usersRepository.findById.mockResolvedValue(user);
          usersRepository.softRemove.mockResolvedValue(user);
          return service.remove(user.id);
        },
      ],
      [
        'restore',
        () => {
          const deleted = buildUser({ deletedAt: new Date() });
          usersRepository.findById
            .mockResolvedValueOnce(deleted)
            .mockResolvedValueOnce(user);
          usersRepository.recover.mockResolvedValue(user);
          return service.restore(user.id);
        },
      ],
      [
        'updateStatus',
        () => {
          usersRepository.findById.mockResolvedValue(user);
          usersRepository.save.mockResolvedValue(user);
          return service.updateStatus(user.id, UserStatus.SUSPENDED);
        },
      ],
    ])('%s invalida la entrada cacheada', async (_name, act) => {
      await act();

      expect(authIdentityCache.invalidate).toHaveBeenCalledWith(user.id);
    });
  });
});
