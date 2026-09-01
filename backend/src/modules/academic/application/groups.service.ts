/**
 * @fileoverview Módulo académico de grupos y matrículas (groups.service).
 *
 * @module groups.service
 */

import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CourseGroup } from '../entities/course-group.entity';
import { StudentTargetResolverService } from '../../users/application/student-target-resolver.service';
import type { ICourseGroupRepository } from '../domain/repositories/course-group.repository.interface';
import { COURSE_GROUP_REPOSITORY } from '../domain/repositories/course-group.repository.interface';
import type { IGroupEnrollmentRepository } from '../domain/repositories/group-enrollment.repository.interface';
import { GROUP_ENROLLMENT_REPOSITORY } from '../domain/repositories/group-enrollment.repository.interface';
import { CreateGroupDto } from '../dto/create-group.dto';
import { BulkEnrollDto } from '../dto/bulk-enroll.dto';
import { GroupEnrollmentEventsService } from '../../../shared/application/group-enrollment-events.service';
import type {
  BulkEnrollResponse,
  GroupEnrollmentResponse,
} from '../academic.types';

@Injectable()
export class GroupsService {
  constructor(
    @Inject(COURSE_GROUP_REPOSITORY)
    private readonly groupsRepository: ICourseGroupRepository,
    @Inject(GROUP_ENROLLMENT_REPOSITORY)
    private readonly enrollmentsRepository: IGroupEnrollmentRepository,
    private readonly studentTargetResolver: StudentTargetResolverService,
    private readonly groupEnrollmentEventsService: GroupEnrollmentEventsService,
  ) {}

  async list(): Promise<Array<CourseGroup & { studentCount: number }>> {
    const groups = await this.groupsRepository.findAllOrderedByCreatedAtDesc();

    if (groups.length === 0) {
      return [];
    }

    // Agregación única por grupo en lugar de consultas N+1 individuales.
    const counts = await this.enrollmentsRepository.countActiveByGroupIds(
      groups.map((group) => group.id),
    );

    // Los grupos sin matriculados no aparecen en un `GROUP BY`, así que el
    // valor por defecto es 0 y no `undefined`: la vista muestra la cifra tal
    // cual y un hueco ahí se leería como un error de carga.
    const countByGroupId = new Map(
      counts.map((row) => [row.groupId, row.studentCount]),
    );

    return groups.map((group) => ({
      ...group,
      studentCount: countByGroupId.get(group.id) ?? 0,
    }));
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
    const groups = await this.groupsRepository.findAllForStudent(studentId);

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
    const group = await this.groupsRepository.findById(groupId);
    if (!group) throw new NotFoundException('Grupo no encontrado');

    Object.assign(group, dto);
    return this.groupsRepository.save(group);
  }

  async listEnrollments(groupId: string): Promise<GroupEnrollmentResponse[]> {
    const enrollments =
      await this.enrollmentsRepository.findByGroupWithStudent(groupId);

    // `student` puede venir null: TypeORM filtra de la relación las filas con
    // `deletedAt` seteado (borrado lógico de users.service#remove), así que
    // una matrícula de un alumno borrado deja de resolver el JOIN aunque la
    // fila de group_enrollments siga existiendo. Sin este fallback, un solo
    // alumno borrado tumbaba el listado entero del grupo.
    return enrollments.map((e) => ({
      id: e.id,
      groupId: e.groupId,
      studentId: e.studentId,
      studentEmail: e.student?.email ?? null,
      studentName: e.student
        ? `${e.student.lastName}, ${e.student.firstName}`.trim()
        : 'Alumno no disponible',
      enrolledById: e.enrolledById,
      enrolledAt: e.enrolledAt,
      revokedAt: e.revokedAt,
    }));
  }

  async bulkEnroll(
    groupId: string,
    dto: BulkEnrollDto,
    enrolledById: string,
  ): Promise<BulkEnrollResponse> {
    const group = await this.groupsRepository.findById(groupId);
    if (!group) throw new NotFoundException('Grupo no encontrado');

    const resolution = await this.studentTargetResolver.resolve(dto);
    const studentIds = resolution.resolvedStudentIds;
    const results: BulkEnrollResponse = {
      enrollments: [],
      summary: {
        requestedIds: resolution.requestedIds,
        requestedEmails: resolution.requestedEmails,
        requestedNames: resolution.requestedNames,
        resolvedStudentIds: studentIds,
        enrolledCount: 0,
        reactivatedCount: 0,
        alreadyActiveCount: 0,
        unresolvedEmails: resolution.unresolvedEmails,
        unresolvedNames: resolution.unresolvedNames,
      },
    };

    // Matrícula masiva atómica bajo transacción para prevenir condiciones de carrera y duplicados.
    if (studentIds.length > 0) {
      const bulkResult = await this.enrollmentsRepository.bulkEnroll(
        groupId,
        studentIds,
        enrolledById,
      );
      results.summary.alreadyActiveCount = bulkResult.alreadyActiveCount;
      results.summary.reactivatedCount = bulkResult.reactivatedCount;
      results.summary.enrolledCount = bulkResult.enrolledCount;
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
    const enrollment = await this.enrollmentsRepository.findById(enrollmentId);
    if (!enrollment) throw new NotFoundException('Matrícula no encontrada');

    enrollment.revokedAt = new Date();
    await this.enrollmentsRepository.save(enrollment);
  }

  async remove(groupId: string): Promise<void> {
    const group = await this.groupsRepository.findById(groupId);
    if (!group) throw new NotFoundException('Grupo no encontrado');

    // Soft delete or hard delete? The repo seems to use hard delete for enrollments in some cases,
    // but here we'll just delete the group.
    // Usually we want to cascade or check if there are active enrollments.
    await this.groupsRepository.softRemove(group);
  }
}
