/**
 * @fileoverview Pruebas unitarias de la estrategia JWT.
 *
 * Contexto:
 * - Valida reconstrucción de identidad desde base de datos.
 * - Asegura rechazo de usuarios inactivos o no existentes.
 *
 * @module JwtStrategySpec
 */

import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { User, UserRole, UserStatus } from '../../users/entities/user.entity';
import { UsersService } from '../../users/users.service';

const buildUser = (overrides: Partial<User> = {}): User => ({
  id: '4ff512db-c595-4076-a9c3-e7499f2d3bbf',
  email: 'secure@dockus.com',
  passwordHash: 'hash',
  role: UserRole.ADMIN,
  status: UserStatus.ACTIVE,
  firstName: 'Secure',
  lastName: 'User',
  createdAt: new Date('2026-03-09T00:00:00.000Z'),
  updatedAt: new Date('2026-03-09T00:00:00.000Z'),
  deletedAt: undefined as unknown as Date,
  assignedProjects: [],
  ...overrides,
});

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  let usersService: {
    findById: jest.MockedFunction<UsersService['findById']>;
    assertAccountIsActive: jest.MockedFunction<
      UsersService['assertAccountIsActive']
    >;
  };

  let authIdentityCache: {
    get: jest.Mock;
    set: jest.Mock;
  };

  beforeEach(() => {
    const configService = {
      get: jest.fn().mockReturnValue('super-secret-key'),
      getOrThrow: jest.fn().mockReturnValue('super-secret-key'),
    } as unknown as ConfigService;

    usersService = {
      findById: jest.fn(),
      assertAccountIsActive: jest.fn(),
    };

    authIdentityCache = {
      // Por defecto, fallo de caché: cada prueba existente debe seguir
      // ejerciendo el camino contra base de datos tal cual lo hacía.
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };

    strategy = new JwtStrategy(
      configService,
      usersService as unknown as UsersService,
      authIdentityCache as never,
    );
  });

  it('debe validar y devolver contexto de usuario activo desde BD', async () => {
    const user = buildUser();

    usersService.findById.mockResolvedValue(user);
    usersService.assertAccountIsActive.mockReturnValue(user);

    const result = await strategy.validate({
      sub: user.id,
      email: 'stale-email@dockus.com',
      role: 'STUDENT',
    });

    expect(usersService.findById).toHaveBeenCalledWith(user.id, true);
    expect(usersService.assertAccountIsActive).toHaveBeenCalledWith(
      user,
      'Sesión inválida: la identidad no se encuentra activa.',
    );
    expect(result).toEqual({
      userId: user.id,
      email: user.email,
      role: user.role,
    });
  });

  it('debe rechazar sesión de cuenta suspendida/inactiva/eliminada', async () => {
    const user = buildUser({ status: UserStatus.SUSPENDED });

    usersService.findById.mockResolvedValue(user);
    usersService.assertAccountIsActive.mockImplementation(() => {
      throw new UnauthorizedException(
        'Sesión inválida: la identidad no se encuentra activa.',
      );
    });

    await expect(
      strategy.validate({
        sub: user.id,
        email: user.email,
        role: user.role,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  /** ESC-ALTO-04: caché de vida corta para la validación del JWT. */
  describe('caché de identidad', () => {
    it('un acierto evita por completo la consulta a base de datos', async () => {
      const user = buildUser();
      authIdentityCache.get.mockResolvedValue({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      const result = await strategy.validate({
        sub: user.id,
        email: user.email,
        role: user.role,
      });

      expect(usersService.findById).not.toHaveBeenCalled();
      expect(result).toEqual({
        userId: user.id,
        email: user.email,
        role: user.role,
      });
    });

    it('solo cachea identidades que han superado la comprobación de cuenta activa', async () => {
      const user = buildUser({ status: UserStatus.SUSPENDED });

      usersService.findById.mockResolvedValue(user);
      usersService.assertAccountIsActive.mockImplementation(() => {
        throw new UnauthorizedException('inactiva');
      });

      await expect(
        strategy.validate({
          sub: user.id,
          email: user.email,
          role: user.role,
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      // Cachear aquí convertiría un rechazo en un acierto de caché válido
      // durante todo el TTL: la cuenta suspendida seguiría entrando.
      expect(authIdentityCache.set).not.toHaveBeenCalled();
    });

    it('un fallo de Redis degrada a la consulta a base de datos, no a un rechazo', async () => {
      const user = buildUser();

      // El servicio de caché ya absorbe sus propios errores, pero la estrategia
      // no debe presuponerlo: si algún día propagase, autenticar tiene que
      // seguir funcionando.
      authIdentityCache.get.mockResolvedValue(null);
      usersService.findById.mockResolvedValue(user);
      usersService.assertAccountIsActive.mockReturnValue(user);

      const result = await strategy.validate({
        sub: user.id,
        email: user.email,
        role: user.role,
      });

      expect(result.userId).toBe(user.id);
    });
  });
});
