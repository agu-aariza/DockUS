/**
 * @fileoverview Adaptador TypeORM de `ICourseGroupRepository`
 * (course-group.repository).
 *
 * @module course-group.repository
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CourseGroup } from '../../entities/course-group.entity';
import { GroupEnrollment } from '../../entities/group-enrollment.entity';
import {
  ICourseGroupRepository,
  NewCourseGroupData,
} from '../../domain/repositories/course-group.repository.interface';

@Injectable()
export class CourseGroupRepository implements ICourseGroupRepository {
  constructor(
    @InjectRepository(CourseGroup)
    private readonly repository: Repository<CourseGroup>,
  ) {}

  findAllOrderedByCreatedAtDesc(): Promise<CourseGroup[]> {
    return this.repository.find({ order: { createdAt: 'DESC' } });
  }

  findAllForStudent(studentId: string): Promise<CourseGroup[]> {
    return this.repository
      .createQueryBuilder('group')
      .innerJoin(
        GroupEnrollment,
        'enrollment',
        'enrollment."groupId" = group.id AND enrollment."studentId" = :studentId AND enrollment."revokedAt" IS NULL',
        { studentId },
      )
      .orderBy('group.name', 'ASC')
      .getMany();
  }

  findById(id: string): Promise<CourseGroup | null> {
    return this.repository.findOne({ where: { id } });
  }

  create(data: NewCourseGroupData): CourseGroup {
    return this.repository.create(data);
  }

  save(group: CourseGroup): Promise<CourseGroup> {
    return this.repository.save(group);
  }

  softRemove(group: CourseGroup): Promise<CourseGroup> {
    return this.repository.softRemove(group);
  }
}
