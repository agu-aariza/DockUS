/**
 * @fileoverview Pruebas unitarias de flujos de autenticación.
 *
 * Contexto:
 * - Cubre login válido, credenciales inválidas y cuentas no activas.
 * - Verifica manejo de conflicto en registro duplicado.
 *
 * @module AuthServiceSpec
 */

import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { User, UserRole, UserStatus } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';

const buildUser = (overrides: Partial<User> = {}): User => ({
  id: '72cf42cc-50b4-4ef1-ae70-d6fd89f5b4ba',
  email: 'active@dockus.com',
  passwordHash: 'hashed-password',
  role: UserRole.STUDENT,
  status: UserStatus.ACTIVE,
  firstName: 'Active',
  lastName: 'User',
  createdAt: new Date('2026-03-09T00:00:00.000Z'),
  updatedAt: new Date('2026-03-09T00:00:00.000Z'),
  deletedAt: undefined as unknown as Date,
  ...overrides,
});

describe('AuthService', () => {
  let service: AuthService;

  let usersService: {
    findByEmailForAuth: jest.MockedFunction<UsersService['findByEmailForAuth']>;
    create: jest.MockedFunction<UsersService['create']>;
    validatePassword: jest.MockedFunction<UsersService['validatePassword']>;
    assertAccountIsActive: jest.MockedFunction<
      UsersService['assertAccountIsActive']
    >;
  };

  let jwtService: {
    sign: jest.MockedFunction<JwtService['sign']>;
  };

  beforeEach(() => {
    usersService = {
      findByEmailForAuth: jest.fn(),
      create: jest.fn(),
      validatePassword: jest.fn(),
      assertAccountIsActive: jest.fn(),
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('signed-token'),
    };

    service = new AuthService(
      usersService as unknown as UsersService,
      jwtService as unknown as JwtService,
    );
  });

  it('debe emitir token cuando las credenciales son válidas y la cuenta está ACTIVE', async () => {
    const dto: LoginDto = {
      email: 'active@dockus.com',
      password: 'password123',
    };
    const user = buildUser();

    usersService.findByEmailForAuth.mockResolvedValue(user);
    usersService.assertAccountIsActive.mockReturnValue(user);
    usersService.validatePassword.mockResolvedValue(true);

    const response = await service.login(dto);

    expect(usersService.findByEmailForAuth).toHaveBeenCalledWith(
      dto.email,
      true,
    );
    expect(usersService.assertAccountIsActive).toHaveBeenCalledWith(user);
    expect(usersService.validatePassword).toHaveBeenCalledWith(
      user.passwordHash,
      dto.password,
    );
    expect(jwtService.sign).toHaveBeenCalledWith({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    expect(response).toEqual({
      user: { id: user.id, email: user.email, role: user.role },
      accessToken: 'signed-token',
    });
  });

  it('debe rechazar login si la cuenta no está activa', async () => {
    const dto: LoginDto = {
      email: 'inactive@dockus.com',
      password: 'password123',
    };
    const inactiveUser = buildUser({
      email: 'inactive@dockus.com',
      status: UserStatus.INACTIVE,
    });

    usersService.findByEmailForAuth.mockResolvedValue(inactiveUser);
    usersService.assertAccountIsActive.mockImplementation(() => {
      throw new UnauthorizedException('Credenciales inválidas proporcionadas.');
    });

    await expect(service.login(dto)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(usersService.findByEmailForAuth).toHaveBeenCalledWith(
      dto.email,
      true,
    );
    expect(usersService.validatePassword).not.toHaveBeenCalled();
  });

  it('debe rechazar registro si el email ya existe incluso en soft-delete', async () => {
    const dto: RegisterDto = {
      email: 'already-used@dockus.com',
      password: 'password123',
      firstName: 'Used',
      lastName: 'Email',
    };

    usersService.create.mockRejectedValue(
      new ConflictException('El email ya está registrado en el sistema.'),
    );

    await expect(service.register(dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(usersService.findByEmailForAuth).not.toHaveBeenCalled();
    expect(usersService.create).toHaveBeenCalledWith(
      dto.email,
      dto.password,
      dto.firstName,
      dto.lastName,
    );
  });
});
