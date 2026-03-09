import { ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
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
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
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
    queryBuilder.andWhere.mockReturnThis();
    queryBuilder.orderBy.mockReturnThis();
    queryBuilder.skip.mockReturnThis();
    queryBuilder.take.mockReturnThis();
    service = new UsersService(usersRepository as unknown as Repository<User>);
  });

  it('debe impedir alta cuando el email existe incluso en registros soft-deleted', async () => {
    const dto: CreateUserDto = {
      email: 'existing@dockus.com',
      password: 'password123',
      firstName: 'Existing',
      lastName: 'User',
    };

    usersRepository.findOne.mockResolvedValue(
      buildUser({
        email: dto.email,
        deletedAt: new Date('2026-03-08T00:00:00.000Z'),
      }),
    );

    await expect(service.createFromDto(dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(usersRepository.findOne).toHaveBeenCalledWith({
      where: { email: dto.email },
      withDeleted: true,
    });
  });

  it('debe devolver todos los usuarios sin paginación', async () => {
    const users = [
      buildUser({ id: '0f4f2a18-bb0d-46df-a4f1-7220f3d63021', email: 'teacher@dockus.com', role: UserRole.TEACHER }),
      buildUser({ id: 'fc0336bf-f1bf-4df7-88f8-86df0251f6ec', email: 'teacher2@dockus.com', role: UserRole.TEACHER }),
    ];

    usersRepository.find.mockResolvedValue(users);

    const result = await service.findAll();

    expect(usersRepository.find).toHaveBeenCalled();
    expect(result).toHaveLength(2);
    expect(result[0].email).toBe('teacher@dockus.com');
    expect((result[0] as { passwordHash?: string }).passwordHash).toBeUndefined();
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
});
