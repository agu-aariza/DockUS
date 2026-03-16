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
import { QueryFailedError, Repository } from 'typeorm';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { User, UserRole, UserStatus } from './entities/user.entity';

const buildUser = (overrides: Partial<User> = {}): User => ({
  id: '2e141a4d-e163-43f8-87f8-75afee5e2f85',
  email: 'user@dockus.com',
  passwordHash: 'hashed-password',
  role: UserRole.STUDENT,
  status: UserStatus.ACTIVE,
  firstName: 'User',
  lastName: 'Dockus',
  createdAt: new Date('2026-03-09T00:00:00.000Z'),
  updatedAt: new Date('2026-03-09T00:00:00.000Z'),
  deletedAt: undefined as unknown as Date,
  ...overrides,
});

describe('UsersService', () => {
  let service: UsersService;

  const queryBuilder = {
    addSelect: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    withDeleted: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
  };

  const usersRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    softRemove: jest.fn(),
    recover: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    queryBuilder.addSelect.mockReturnThis();
    queryBuilder.andWhere.mockReturnThis();
    queryBuilder.where.mockReturnThis();
    queryBuilder.withDeleted.mockReturnThis();
    queryBuilder.orderBy.mockReturnThis();
    queryBuilder.skip.mockReturnThis();
    queryBuilder.take.mockReturnThis();
    service = new UsersService(usersRepository as unknown as Repository<User>);
  });

  it('debe normalizar email en findByEmail antes de consultar', async () => {
    usersRepository.findOne.mockResolvedValue(null);

    await service.findByEmail('  TeSt@DockUs.com  ', true);

    expect(usersRepository.findOne).toHaveBeenCalledWith({
      where: { email: 'test@dockus.com' },
      withDeleted: true,
    });
  });

  it('debe cargar passwordHash solo en el lookup explícito de autenticación', async () => {
    const user = buildUser({ email: 'secure@dockus.com' });
    queryBuilder.getOne.mockResolvedValue(user);

    const result = await service.findByEmailForAuth(
      '  Secure@DockUs.com  ',
      true,
    );

    expect(usersRepository.createQueryBuilder).toHaveBeenCalledWith('user');
    expect(queryBuilder.addSelect).toHaveBeenCalledWith('user.passwordHash');
    expect(queryBuilder.where).toHaveBeenCalledWith('user.email = :email', {
      email: 'secure@dockus.com',
    });
    expect(queryBuilder.withDeleted).toHaveBeenCalled();
    expect(result).toBe(user);
  });

  it('debe normalizar email al crear usuarios internamente', async () => {
    const savedUser = buildUser({ email: 'test@dockus.com' });
    usersRepository.save.mockResolvedValue(savedUser);

    await service.create('  TeSt@DockUs.com  ', 'password123', 'Test', 'User');

    expect(usersRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'test@dockus.com',
      }),
    );
  });

  it('debe traducir error de unicidad de BD a ConflictException al crear usuario', async () => {
    const dto: CreateUserDto = {
      email: 'existing@dockus.com',
      password: 'password123',
      firstName: 'Existing',
      lastName: 'User',
    };
    const uniqueViolation = new QueryFailedError('INSERT INTO users', [], {
      code: '23505',
    });
    usersRepository.save.mockRejectedValue(uniqueViolation);

    await expect(service.createFromDto(dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(usersRepository.findOne).not.toHaveBeenCalled();
    expect(usersRepository.save).toHaveBeenCalled();
  });

  it('debe devolver un listado paginado con metadatos y usuarios sanitizados', async () => {
    const users = [
      buildUser({
        id: '0f4f2a18-bb0d-46df-a4f1-7220f3d63021',
        email: 'teacher@dockus.com',
        role: UserRole.TEACHER,
      }),
      buildUser({
        id: 'fc0336bf-f1bf-4df7-88f8-86df0251f6ec',
        email: 'teacher2@dockus.com',
        role: UserRole.TEACHER,
      }),
    ];
    queryBuilder.getManyAndCount.mockResolvedValue([users, 2]);

    const result = await service.findAll({
      page: 1,
      limit: 20,
      sortBy: 'createdAt',
      sortOrder: 'DESC',
    });

    expect(usersRepository.createQueryBuilder).toHaveBeenCalledWith('user');
    expect(queryBuilder.orderBy).toHaveBeenCalledWith('user.createdAt', 'DESC');
    expect(queryBuilder.skip).toHaveBeenCalledWith(0);
    expect(queryBuilder.take).toHaveBeenCalledWith(20);
    expect(result.data).toHaveLength(2);
    expect(result.data[0].email).toBe('teacher@dockus.com');
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
    queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

    await service.findAll({
      page: 2,
      limit: 10,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      search: 'dock',
      sortBy: 'email',
      sortOrder: 'ASC',
    });

    expect(queryBuilder.andWhere).toHaveBeenNthCalledWith(
      1,
      'user.role = :role',
      { role: UserRole.ADMIN },
    );
    expect(queryBuilder.andWhere).toHaveBeenNthCalledWith(
      2,
      'user.status = :status',
      { status: UserStatus.ACTIVE },
    );
    expect(queryBuilder.andWhere).toHaveBeenNthCalledWith(
      3,
      '(user.email ILIKE :search OR user.firstName ILIKE :search OR user.lastName ILIKE :search)',
      { search: '%dock%' },
    );
    expect(queryBuilder.orderBy).toHaveBeenCalledWith('user.email', 'ASC');
    expect(queryBuilder.skip).toHaveBeenCalledWith(10);
    expect(queryBuilder.take).toHaveBeenCalledWith(10);
  });

  it('debe normalizar email en update antes de persistir', async () => {
    const existing = buildUser({
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'existing@dockus.com',
    });
    const updated = buildUser({
      id: existing.id,
      email: 'new.email@dockus.com',
    });

    usersRepository.findOne
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(null);
    usersRepository.save.mockResolvedValue(updated);

    const result = await service.update(existing.id, {
      email: '  New.Email@DockUs.com  ',
    });

    expect(usersRepository.findOne).toHaveBeenNthCalledWith(2, {
      where: { email: 'new.email@dockus.com' },
      withDeleted: true,
    });
    expect(usersRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: existing.id,
        email: 'new.email@dockus.com',
      }),
    );
    expect(result.email).toBe('new.email@dockus.com');
  });

  it('debe aplicar soft delete al eliminar identidad', async () => {
    const user = buildUser();

    usersRepository.findOne.mockResolvedValue(user);
    usersRepository.softRemove.mockResolvedValue(user);

    const result = await service.remove(user.id);

    expect(usersRepository.findOne).toHaveBeenCalledWith({
      where: { id: user.id },
      withDeleted: false,
    });
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

    usersRepository.findOne
      .mockResolvedValueOnce(deletedUser)
      .mockResolvedValueOnce(restoredUser);
    usersRepository.recover.mockResolvedValue(restoredUser);

    const result = await service.restore(deletedUser.id);

    expect(usersRepository.findOne).toHaveBeenNthCalledWith(1, {
      where: { id: deletedUser.id },
      withDeleted: true,
    });
    expect(usersRepository.recover).toHaveBeenCalledWith(deletedUser);
    expect(usersRepository.findOne).toHaveBeenNthCalledWith(2, {
      where: { id: deletedUser.id },
      withDeleted: false,
    });
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

    usersRepository.findOne.mockResolvedValue(user);
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
      service.validatePassword('hashed-password', 'plain-password'),
    ).resolves.toBe(false);
  });
});
