/**
 * @fileoverview Resolución común de alumnos para operaciones masivas.
 *
 * Contexto:
 * - Normaliza identificadores, correos y nombres sin mutar el input.
 * - Centraliza la validación del rol STUDENT.
 * - Solo consulta el puerto de usuarios: no conoce proyectos, grupos ni
 *   persistencia de matrículas/asignaciones.
 *
 * @module StudentTargetResolverService
 */

import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { User } from '../entities/user.entity';
import { UserRole } from '../entities/user.entity';
import type { IUserRepository } from '../domain/repositories/user.repository.interface';
import { USER_REPOSITORY } from '../domain/repositories/user.repository.interface';

export interface StudentTargetResolverInput {
  studentIds?: readonly string[];
  studentEmails?: readonly string[];
  studentNames?: readonly string[];
  rawInput?: string;
}

export interface StudentTargetResolution {
  students: User[];
  resolvedStudentIds: string[];
  requestedIds: string[];
  requestedEmails: string[];
  requestedNames: string[];
  unresolvedEmails: string[];
  unresolvedNames: string[];
}

interface ParsedName {
  firstName: string;
  lastName: string;
}

interface ParsedRawInput {
  emails: string[];
  names: string[];
}

@Injectable()
export class StudentTargetResolverService {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly usersRepository: IUserRepository,
  ) {}

  async resolve(
    input: StudentTargetResolverInput = {},
  ): Promise<StudentTargetResolution> {
    const rawInput = this.parseRawInput(input.rawInput);
    const requestedIds = this.uniqueStrings([...(input.studentIds ?? [])]);
    const requestedEmails = this.uniqueStrings(
      [...(input.studentEmails ?? []), ...rawInput.emails].map((email) =>
        email.trim().toLowerCase(),
      ),
    );
    const requestedNames = this.uniqueNames([
      ...(input.studentNames ?? []),
      ...rawInput.names,
    ]);

    if (
      requestedIds.length === 0 &&
      requestedEmails.length === 0 &&
      requestedNames.length === 0
    ) {
      return {
        students: [],
        resolvedStudentIds: [],
        requestedIds,
        requestedEmails,
        requestedNames,
        unresolvedEmails: [],
        unresolvedNames: [],
      };
    }

    const usersById = new Map<string, User>();

    const usersByEmail = requestedEmails.length
      ? await this.usersRepository.findByEmails(requestedEmails)
      : [];
    this.assertStudents(usersByEmail);
    usersByEmail.forEach((student) => usersById.set(student.id, student));

    const emailByNormalizedValue = new Map(
      usersByEmail.map((student) => [
        student.email.trim().toLowerCase(),
        student.id,
      ]),
    );
    const unresolvedEmails = requestedEmails.filter(
      (email) => !emailByNormalizedValue.has(email),
    );

    const usersByRequestedId = requestedIds.length
      ? await this.usersRepository.findByIds(requestedIds)
      : [];
    this.assertStudents(usersByRequestedId);
    usersByRequestedId.forEach((student) => usersById.set(student.id, student));

    const requestedIdSet = new Set(
      usersByRequestedId.map((student) => student.id),
    );
    const missingIds = requestedIds.filter((id) => !requestedIdSet.has(id));
    if (missingIds.length > 0) {
      throw new NotFoundException(
        'No se pudieron resolver todos los alumnos solicitados.',
      );
    }

    const unresolvedNames: string[] = [];
    const resolvedNameIds: string[] = [];
    for (const name of requestedNames) {
      const parsedName = this.parseName(name);
      if (!parsedName) {
        unresolvedNames.push(name);
        continue;
      }

      const candidates = await this.usersRepository.findByNameAndRole(
        parsedName.firstName,
        parsedName.lastName,
        UserRole.STUDENT,
      );
      this.assertStudents(candidates);

      // Un nombre ambiguo no se asigna silenciosamente a un alumno arbitrario.
      if (candidates.length !== 1) {
        unresolvedNames.push(name);
        continue;
      }

      usersById.set(candidates[0].id, candidates[0]);
      resolvedNameIds.push(candidates[0].id);
    }

    const resolvedStudentIds = this.uniqueStrings([
      ...requestedIds,
      ...usersByEmail.map((student) => student.id),
      ...resolvedNameIds,
    ]);

    const students = resolvedStudentIds
      .map((studentId) => usersById.get(studentId))
      .filter((student): student is User => Boolean(student));

    return {
      students,
      resolvedStudentIds,
      requestedIds,
      requestedEmails,
      requestedNames,
      unresolvedEmails,
      unresolvedNames,
    };
  }

  private assertStudents(users: User[]): void {
    const nonStudents = users.filter((user) => user.role !== UserRole.STUDENT);
    if (nonStudents.length === 0) return;

    throw new ConflictException(
      `El usuario ${nonStudents[0].email} no tiene rol STUDENT.`,
    );
  }

  private parseRawInput(rawInput?: string): ParsedRawInput {
    if (!rawInput?.trim()) {
      return { emails: [], names: [] };
    }

    const emails: string[] = [];
    const names: string[] = [];

    // Las líneas y punto y coma separan registros. Una coma dentro de un
    // registro sin email se conserva para admitir "Apellido, Nombre".
    for (const entry of rawInput
      .split(/[\r\n;]+/)
      .map((value) => value.trim())
      .filter(Boolean)) {
      if (entry.includes('@')) {
        emails.push(
          ...entry
            .split(',')
            .map((value) => value.trim())
            .filter((value) => value.includes('@')),
        );
      } else {
        names.push(entry);
      }
    }

    return { emails, names };
  }

  private parseName(value: string): ParsedName | null {
    if (value.includes(',')) {
      const [lastName, firstName, ...extra] = value.split(',');
      if (
        extra.some((part) => part.trim()) ||
        !lastName?.trim() ||
        !firstName?.trim()
      ) {
        return null;
      }
      return {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      };
    }

    const parts = value.split(/\s+/).filter(Boolean);
    if (parts.length < 2) return null;

    return {
      firstName: parts[0],
      lastName: parts.slice(1).join(' '),
    };
  }

  private uniqueStrings(values: readonly string[]): string[] {
    return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  }

  private uniqueNames(values: readonly string[]): string[] {
    const namesByKey = new Map<string, string>();
    for (const value of values) {
      const normalized = value.trim().replace(/\s+/g, ' ');
      if (!normalized) continue;
      const key = normalized.toLowerCase();
      if (!namesByKey.has(key)) namesByKey.set(key, normalized);
    }
    return [...namesByKey.values()];
  }
}
