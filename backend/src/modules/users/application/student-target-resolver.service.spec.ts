import { ConflictException } from '@nestjs/common';
import type { IUserRepository } from '../domain/repositories/user.repository.interface';
import { User, UserRole } from '../entities/user.entity';
import { StudentTargetResolverService } from './student-target-resolver.service';

describe('StudentTargetResolverService', () => {
  function buildUser(overrides: Partial<User> = {}): User {
    return {
      id: 'student-1',
      email: 'student@example.com',
      firstName: 'John',
      lastName: 'Doe',
      role: UserRole.STUDENT,
      ...overrides,
    } as User;
  }

  function build() {
    const usersRepository = {
      findByIds: jest.fn().mockResolvedValue([]),
      findByEmails: jest.fn().mockResolvedValue([]),
      findByNameAndRole: jest.fn().mockResolvedValue([]),
    };

    return {
      service: new StudentTargetResolverService(
        usersRepository as unknown as IUserRepository,
      ),
      usersRepository,
    };
  }

  it('normaliza y deduplica IDs sin mutar el array recibido', async () => {
    const { service, usersRepository } = build();
    const student = buildUser();
    const studentIds = [' student-1 ', 'student-1', ''];
    usersRepository.findByIds.mockResolvedValue([student]);

    const result = await service.resolve({ studentIds });

    expect(usersRepository.findByIds).toHaveBeenCalledWith(['student-1']);
    expect(result.requestedIds).toEqual(['student-1']);
    expect(result.resolvedStudentIds).toEqual(['student-1']);
    expect(studentIds).toEqual([' student-1 ', 'student-1', '']);
  });

  it('normaliza correos con mayúsculas y espacios', async () => {
    const { service, usersRepository } = build();
    const student = buildUser();
    usersRepository.findByEmails.mockResolvedValue([student]);

    const result = await service.resolve({
      studentEmails: ['  STUDENT@EXAMPLE.COM ', 'student@example.com'],
    });

    expect(usersRepository.findByEmails).toHaveBeenCalledWith([
      'student@example.com',
    ]);
    expect(result.requestedEmails).toEqual(['student@example.com']);
    expect(result.students).toEqual([student]);
  });

  it('soporta los formatos Apellido, Nombre y Nombre Apellido', async () => {
    const { service, usersRepository } = build();
    const student = buildUser();
    usersRepository.findByNameAndRole.mockResolvedValue([student]);

    const result = await service.resolve({
      studentNames: [' Doe, John ', 'John   Doe'],
    });

    expect(usersRepository.findByNameAndRole).toHaveBeenNthCalledWith(
      1,
      'John',
      'Doe',
      UserRole.STUDENT,
    );
    expect(usersRepository.findByNameAndRole).toHaveBeenNthCalledWith(
      2,
      'John',
      'Doe',
      UserRole.STUDENT,
    );
    expect(result.resolvedStudentIds).toEqual(['student-1']);
  });

  it('marca como no resuelto un nombre ambiguo', async () => {
    const { service, usersRepository } = build();
    usersRepository.findByNameAndRole.mockResolvedValue([
      buildUser({ id: 'student-1' }),
      buildUser({ id: 'student-2', email: 'other@example.com' }),
    ]);

    const result = await service.resolve({ studentNames: ['Doe, John'] });

    expect(result.unresolvedNames).toEqual(['Doe, John']);
    expect(result.resolvedStudentIds).toEqual([]);
    expect(result.students).toEqual([]);
  });

  it('devuelve los correos inexistentes como unresolvedEmails', async () => {
    const { service } = build();

    const result = await service.resolve({
      studentEmails: ['missing@example.com'],
    });

    expect(result.unresolvedEmails).toEqual(['missing@example.com']);
    expect(result.students).toEqual([]);
  });

  it('rechaza usuarios que no tienen rol STUDENT', async () => {
    const { service, usersRepository } = build();
    usersRepository.findByIds.mockResolvedValue([
      buildUser({ role: UserRole.TEACHER }),
    ]);

    await expect(
      service.resolve({ studentIds: ['student-1'] }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('acepta input vacío sin consultar el repositorio', async () => {
    const { service, usersRepository } = build();

    await expect(service.resolve({})).resolves.toEqual({
      students: [],
      resolvedStudentIds: [],
      requestedIds: [],
      requestedEmails: [],
      requestedNames: [],
      unresolvedEmails: [],
      unresolvedNames: [],
    });
    expect(usersRepository.findByIds).not.toHaveBeenCalled();
    expect(usersRepository.findByEmails).not.toHaveBeenCalled();
    expect(usersRepository.findByNameAndRole).not.toHaveBeenCalled();
  });

  it('procesa rawInput sin mutar los arrays del DTO', async () => {
    const { service, usersRepository } = build();
    const student = buildUser();
    const studentIds = ['student-1'];
    const studentEmails = ['  STUDENT@EXAMPLE.COM '];
    const studentNames = [' Doe, John '];
    usersRepository.findByEmails.mockResolvedValue([student]);
    usersRepository.findByIds.mockResolvedValue([student]);
    usersRepository.findByNameAndRole.mockResolvedValue([student]);

    await service.resolve({
      studentIds,
      studentEmails,
      studentNames,
      rawInput: 'other@example.com',
    });

    expect(studentIds).toEqual(['student-1']);
    expect(studentEmails).toEqual(['  STUDENT@EXAMPLE.COM ']);
    expect(studentNames).toEqual([' Doe, John ']);
  });
});
