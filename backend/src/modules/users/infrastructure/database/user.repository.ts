/**
 * @fileoverview Adaptador TypeORM de `IUserRepository`
 * (user.repository).
 *
 * @module user.repository
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User, UserRole } from '../../entities/user.entity';
import type { UserSortField } from '../../dto/list-users-query.dto';
import {
  IUserRepository,
  NewUserData,
  UserListPage,
  UserListQuery,
} from '../../domain/repositories/user.repository.interface';

const USER_SORT_COLUMNS: Record<UserSortField, string> = {
  createdAt: 'user.createdAt',
  updatedAt: 'user.updatedAt',
  email: 'user.email',
  firstName: 'user.firstName',
  lastName: 'user.lastName',
  role: 'user.role',
  status: 'user.status',
};

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(
    @InjectRepository(User)
    private readonly repository: Repository<User>,
  ) {}

  findById(id: string, includeDeleted = false): Promise<User | null> {
    return this.repository.findOne({
      where: { id },
      withDeleted: includeDeleted,
    });
  }

  findByEmail(email: string, includeDeleted = false): Promise<User | null> {
    return this.repository.findOne({
      where: { email },
      withDeleted: includeDeleted,
    });
  }

  findByEmailWithPasswordHash(
    email: string,
    includeDeleted = false,
  ): Promise<User | null> {
    const queryBuilder = this.repository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email });

    if (includeDeleted) {
      queryBuilder.withDeleted();
    }

    return queryBuilder.getOne();
  }

  findByIdAndRole(id: string, role: UserRole): Promise<User | null> {
    return this.repository.findOne({ where: { id, role } });
  }

  findByIds(ids: string[]): Promise<User[]> {
    if (ids.length === 0) {
      return Promise.resolve([]);
    }
    return this.repository.find({ where: { id: In(ids) } });
  }

  findByEmails(emails: string[], role?: UserRole): Promise<User[]> {
    if (emails.length === 0) {
      return Promise.resolve([]);
    }
    if (role) {
      return this.repository.find({ where: { email: In(emails), role } });
    }
    return this.repository.find({
      where: emails.map((email) => ({ email })),
    });
  }

  findByNameAndRole(
    firstName: string,
    lastName: string,
    role: UserRole,
  ): Promise<User[]> {
    return this.repository.find({ where: { firstName, lastName, role } });
  }

  async findPaginated(query: UserListQuery): Promise<UserListPage> {
    const { role, status, search, sortBy, sortOrder, page, limit } = query;
    const queryBuilder = this.repository.createQueryBuilder('user');

    if (role) {
      queryBuilder.andWhere('user.role = :role', { role });
    }

    if (status) {
      queryBuilder.andWhere('user.status = :status', { status });
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

    const [data, total] = await queryBuilder.getManyAndCount();
    return { data, total };
  }

  create(data: NewUserData): User {
    return this.repository.create(data);
  }

  save(user: User): Promise<User> {
    return this.repository.save(user);
  }

  softRemove(user: User): Promise<User> {
    return this.repository.softRemove(user);
  }

  recover(user: User): Promise<User> {
    return this.repository.recover(user);
  }
}
