import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull } from 'typeorm';
import { CourseGroup } from '../entities/course-group.entity';
import { GroupEnrollment } from '../entities/group-enrollment.entity';
import { User, UserRole } from '../../users/entities/user.entity';
import { CreateGroupDto } from '../dto/create-group.dto';
import { BulkEnrollDto } from '../dto/bulk-enroll.dto';

@Injectable()
export class GroupsService {
  constructor(
    @InjectRepository(CourseGroup)
    private readonly groupsRepository: Repository<CourseGroup>,
    @InjectRepository(GroupEnrollment)
    private readonly enrollmentsRepository: Repository<GroupEnrollment>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async list(): Promise<any[]> {
    const groups = await this.groupsRepository.find({
      order: { createdAt: 'DESC' },
    });

    // Count students per group
    return Promise.all(
      groups.map(async (group) => {
        const studentCount = await this.enrollmentsRepository.count({
          where: { groupId: group.id, revokedAt: IsNull() },
        });
        return { ...group, studentCount };
      }),
    );
  }

  async create(dto: CreateGroupDto, creatorId: string): Promise<CourseGroup> {
    const group = this.groupsRepository.create({
      ...dto,
      createdById: creatorId,
    });
    return this.groupsRepository.save(group);
  }

  async listEnrollments(groupId: string): Promise<any[]> {
    const enrollments = await this.enrollmentsRepository.find({
      where: { groupId },
      relations: ['student'],
      order: { enrolledAt: 'DESC' },
    });

    return enrollments.map((e) => ({
      id: e.id,
      groupId: e.groupId,
      studentId: e.studentId,
      studentEmail: e.student.email,
      studentName: `${e.student.firstName} ${e.student.lastName}`.trim(),
      enrolledById: e.enrolledById,
      enrolledAt: e.enrolledAt,
      revokedAt: e.revokedAt,
    }));
  }

  async bulkEnroll(
    groupId: string,
    dto: BulkEnrollDto,
    enrolledById: string,
  ): Promise<any> {
    const group = await this.groupsRepository.findOne({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Grupo no encontrado');

    const studentIds = dto.studentIds || [];
    const studentEmails = dto.studentEmails || [];

    // Find students by email if provided
    if (studentEmails.length > 0) {
      const emailStudents = await this.usersRepository.find({
        where: { email: In(studentEmails), role: UserRole.STUDENT },
      });
      emailStudents.forEach((s) => {
        if (!studentIds.includes(s.id)) studentIds.push(s.id);
      });
    }

    const results = {
      enrollments: [],
      summary: {
        requestedIds: dto.studentIds || [],
        requestedEmails: dto.studentEmails || [],
        resolvedStudentIds: studentIds,
        enrolledCount: 0,
        reactivatedCount: 0,
        alreadyActiveCount: 0,
        unresolvedEmails: [] as string[],
      },
    };

    // Calculate unresolved emails
    const foundStudents = await this.usersRepository.find({
      where: { id: In(studentIds) },
      select: ['email'],
    });
    const foundEmails = foundStudents.map((s) => s.email);
    results.summary.unresolvedEmails = studentEmails.filter(
      (email) => !foundEmails.includes(email),
    );

    for (const studentId of studentIds) {
      const existing = await this.enrollmentsRepository.findOne({
        where: { groupId, studentId },
      });

      if (existing) {
        if (existing.revokedAt) {
          existing.revokedAt = null;
          existing.enrolledById = enrolledById;
          existing.enrolledAt = new Date();
          await this.enrollmentsRepository.save(existing);
          results.summary.reactivatedCount++;
        } else {
          results.summary.alreadyActiveCount++;
        }
        continue;
      }

      const enrollment = this.enrollmentsRepository.create({
        groupId,
        studentId,
        enrolledById,
      });
      await this.enrollmentsRepository.save(enrollment);
      results.summary.enrolledCount++;
    }

    return results;
  }

  async revokeEnrollment(enrollmentId: string): Promise<void> {
    const enrollment = await this.enrollmentsRepository.findOne({
      where: { id: enrollmentId },
    });
    if (!enrollment) throw new NotFoundException('Matrícula no encontrada');

    enrollment.revokedAt = new Date();
    await this.enrollmentsRepository.save(enrollment);
  }
}
