import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, IsNull } from 'typeorm';
import { CourseGroup } from '../entities/course-group.entity';
import { GroupEnrollment } from '../entities/group-enrollment.entity';
import { User, UserRole } from '../../users/entities/user.entity';
import { CreateGroupDto } from '../dto/create-group.dto';
import { BulkEnrollDto } from '../dto/bulk-enroll.dto';
import { GroupEnrollmentEventsService } from '../../../shared/application/group-enrollment-events.service';

@Injectable()
export class GroupsService {
  constructor(
    @InjectRepository(CourseGroup)
    private readonly groupsRepository: Repository<CourseGroup>,
    @InjectRepository(GroupEnrollment)
    private readonly enrollmentsRepository: Repository<GroupEnrollment>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly groupEnrollmentEventsService: GroupEnrollmentEventsService,
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

  async listGroups(): Promise<
    Array<{ id: string; name: string; code: string | null }>
  > {
    const groups = await this.list();
    return groups.map((group) => ({
      id: group.id,
      name: group.name,
      code: group.code ?? null,
    }));
  }

  /**
   * Grupos vigentes de un alumno. Las matrículas son soft-revoke, así que una
   * revocada (`revokedAt`) no cuenta aunque la fila siga en la tabla.
   */
  async listGroupsForStudent(
    studentId: string,
  ): Promise<Array<{ id: string; name: string; code: string | null }>> {
    const groups = await this.groupsRepository
      .createQueryBuilder('group')
      .innerJoin(
        GroupEnrollment,
        'enrollment',
        'enrollment."groupId" = group.id AND enrollment."studentId" = :studentId AND enrollment."revokedAt" IS NULL',
        { studentId },
      )
      .orderBy('group.name', 'ASC')
      .getMany();

    return groups.map((group) => ({
      id: group.id,
      name: group.name,
      code: group.code ?? null,
    }));
  }

  async create(dto: CreateGroupDto, creatorId: string): Promise<CourseGroup> {
    const group = this.groupsRepository.create({
      ...dto,
      createdById: creatorId,
    });
    return this.groupsRepository.save(group);
  }

  async update(
    groupId: string,
    dto: Partial<CreateGroupDto>,
  ): Promise<CourseGroup> {
    const group = await this.groupsRepository.findOne({
      where: { id: groupId },
    });
    if (!group) throw new NotFoundException('Grupo no encontrado');

    Object.assign(group, dto);
    return this.groupsRepository.save(group);
  }

  async listEnrollments(groupId: string): Promise<any[]> {
    const enrollments = await this.enrollmentsRepository.find({
      where: { groupId },
      relations: { student: true },
      order: { enrolledAt: 'DESC' },
    });

    return enrollments.map((e) => ({
      id: e.id,
      groupId: e.groupId,
      studentId: e.studentId,
      studentEmail: e.student.email,
      studentName: `${e.student.lastName}, ${e.student.firstName}`.trim(),
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
    const group = await this.groupsRepository.findOne({
      where: { id: groupId },
    });
    if (!group) throw new NotFoundException('Grupo no encontrado');

    const studentIds = dto.studentIds || [];
    const studentEmails = dto.studentEmails || [];
    const studentNames = dto.studentNames || [];

    // Parse raw input if provided
    if (dto.rawInput) {
      const lines = dto.rawInput
        .split(/[\n,;]+/)
        .map((l) => l.trim())
        .filter(Boolean);

      for (const line of lines) {
        if (line.includes('@')) {
          if (!studentEmails.includes(line.toLowerCase())) {
            studentEmails.push(line.toLowerCase());
          }
        } else {
          if (!studentNames.includes(line)) {
            studentNames.push(line);
          }
        }
      }
    }

    // Find students by email if provided
    if (studentEmails.length > 0) {
      const emailStudents = await this.usersRepository.find({
        where: { email: In(studentEmails), role: UserRole.STUDENT },
      });
      emailStudents.forEach((s) => {
        if (!studentIds.includes(s.id)) studentIds.push(s.id);
      });
    }

    // Find students by name/surname if provided
    for (const name of studentNames) {
      const cleanName = name.trim();
      if (!cleanName) continue;

      // Try searching by "LastName, FirstName" or "FirstName LastName"
      const parts = cleanName.includes(',')
        ? cleanName.split(',').map((p) => p.trim())
        : cleanName.split(' ').map((p) => p.trim());

      let students: User[] = [];

      if (cleanName.includes(',')) {
        // Format: "LastName, FirstName"
        students = await this.usersRepository.find({
          where: {
            lastName: parts[0],
            firstName: parts[1],
            role: UserRole.STUDENT,
          },
        });
      } else if (parts.length >= 2) {
        // Format: "FirstName LastName" (simple)
        students = await this.usersRepository.find({
          where: {
            firstName: parts[0],
            lastName: parts[1],
            role: UserRole.STUDENT,
          },
        });
      }

      // If only one match, add it
      if (students.length === 1) {
        const s = students[0];
        if (!studentIds.includes(s.id)) studentIds.push(s.id);
      }
    }

    const results = {
      enrollments: [],
      summary: {
        requestedIds: dto.studentIds || [],
        requestedEmails: dto.studentEmails || [],
        requestedNames: dto.studentNames || [],
        resolvedStudentIds: studentIds,
        enrolledCount: 0,
        reactivatedCount: 0,
        alreadyActiveCount: 0,
        unresolvedEmails: [] as string[],
        unresolvedNames: [] as string[],
      },
    };

    // Calculate unresolved emails
    let foundStudents: User[] = [];
    if (studentIds.length > 0) {
      foundStudents = await this.usersRepository.find({
        where: { id: In(studentIds) },
        select: { id: true, email: true, firstName: true, lastName: true },
      });
    }
    const foundEmails = foundStudents.map((s) => s.email);
    results.summary.unresolvedEmails = studentEmails.filter(
      (email) => !foundEmails.includes(email),
    );

    // Calculate unresolved names (best effort)
    const foundFullNames = foundStudents.map((s) =>
      `${s.lastName}, ${s.firstName}`.toLowerCase(),
    );
    const foundSimpleNames = foundStudents.map((s) =>
      `${s.firstName} ${s.lastName}`.toLowerCase(),
    );
    results.summary.unresolvedNames = studentNames.filter((name) => {
      const ln = name.toLowerCase().trim();
      return !foundFullNames.includes(ln) && !foundSimpleNames.includes(ln);
    });

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

    // Sync project assignments for the newly enrolled students
    if (studentIds.length > 0) {
      await this.groupEnrollmentEventsService.publishStudentsEnrolled({
        groupId,
        studentIds,
      });
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

  async remove(groupId: string): Promise<void> {
    const group = await this.groupsRepository.findOne({
      where: { id: groupId },
    });
    if (!group) throw new NotFoundException('Grupo no encontrado');

    // Soft delete or hard delete? The repo seems to use hard delete for enrollments in some cases,
    // but here we'll just delete the group.
    // Usually we want to cascade or check if there are active enrollments.
    await this.groupsRepository.softRemove(group);
  }
}
