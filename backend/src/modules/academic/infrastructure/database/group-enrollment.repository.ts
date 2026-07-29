/**
 * @fileoverview Adaptador TypeORM de `IGroupEnrollmentRepository`
 * (group-enrollment.repository).
 *
 * @module group-enrollment.repository
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { GroupEnrollment } from '../../entities/group-enrollment.entity';
import {
  BulkEnrollResult,
  GroupEnrollmentCountByGroup,
  IGroupEnrollmentRepository,
} from '../../domain/repositories/group-enrollment.repository.interface';

@Injectable()
export class GroupEnrollmentRepository implements IGroupEnrollmentRepository {
  constructor(
    @InjectRepository(GroupEnrollment)
    private readonly repository: Repository<GroupEnrollment>,
  ) {}

  async countActiveByGroupIds(
    groupIds: string[],
  ): Promise<GroupEnrollmentCountByGroup[]> {
    if (groupIds.length === 0) {
      return [];
    }

    const counts = await this.repository
      .createQueryBuilder('enrollment')
      .select('enrollment.groupId', 'groupId')
      .addSelect('COUNT(*)', 'studentCount')
      .where('enrollment.groupId IN (:...groupIds)', { groupIds })
      .andWhere('enrollment.revokedAt IS NULL')
      .groupBy('enrollment.groupId')
      .getRawMany<{ groupId: string; studentCount: string }>();

    return counts.map((row) => ({
      groupId: row.groupId,
      studentCount: Number(row.studentCount),
    }));
  }

  findByGroupWithStudent(groupId: string): Promise<GroupEnrollment[]> {
    return this.repository.find({
      where: { groupId },
      relations: { student: true },
      order: { enrolledAt: 'DESC' },
    });
  }

  findById(id: string): Promise<GroupEnrollment | null> {
    return this.repository.findOne({ where: { id } });
  }

  save(enrollment: GroupEnrollment): Promise<GroupEnrollment> {
    return this.repository.save(enrollment);
  }

  async bulkEnroll(
    groupId: string,
    studentIds: string[],
    enrolledById: string,
  ): Promise<BulkEnrollResult> {
    const result: BulkEnrollResult = {
      alreadyActiveCount: 0,
      reactivatedCount: 0,
      enrolledCount: 0,
    };

    if (studentIds.length === 0) {
      return result;
    }

    await this.repository.manager.transaction(async (manager) => {
      const existing = await manager.find(GroupEnrollment, {
        where: { groupId, studentId: In(studentIds) },
      });

      const existingByStudentId = new Map(
        existing.map((enrollment) => [enrollment.studentId, enrollment]),
      );

      const toReactivate = existing.filter(
        (enrollment) => enrollment.revokedAt !== null,
      );
      const toInsert = studentIds.filter(
        (studentId) => !existingByStudentId.has(studentId),
      );

      result.alreadyActiveCount = existing.length - toReactivate.length;

      if (toReactivate.length > 0) {
        await manager.update(
          GroupEnrollment,
          { id: In(toReactivate.map((enrollment) => enrollment.id)) },
          { revokedAt: null, enrolledById, enrolledAt: new Date() },
        );
        result.reactivatedCount = toReactivate.length;
      }

      if (toInsert.length > 0) {
        // `orIgnore` cierra la carrera que quedaba: si otra petición
        // concurrente insertó la misma matrícula entre la lectura y este
        // punto, la fila duplicada se descarta en lugar de abortar el lote.
        const inserted = await manager
          .createQueryBuilder()
          .insert()
          .into(GroupEnrollment)
          .values(
            toInsert.map((studentId) => ({
              groupId,
              studentId,
              enrolledById,
            })),
          )
          .orIgnore()
          .execute();

        result.enrolledCount = inserted.identifiers.filter(Boolean).length;
      }
    });

    return result;
  }
}
