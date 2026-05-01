import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { ProjectAssignment } from './assignments/entities/project-assignment.entity';
import { CreateProjectDto, UpdateProjectDto } from './dto/create-project.dto';
import { Project, ProjectStatus } from './entities/project.entity';
import { ProjectAccessService } from './project-access.service';
import { ProjectRuntimeService } from './runtime/project-runtime.service';
import { Delivery } from './deliveries/entities/delivery.entity';

@Injectable()
export class ProjectLifecycleService {
  constructor(
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
    @InjectRepository(Delivery)
    private readonly deliveriesRepository: Repository<Delivery>,
    private readonly projectRuntimeService: ProjectRuntimeService,
    private readonly projectAccessService: ProjectAccessService,
  ) {}

  async create(dto: CreateProjectDto, creatorId: string): Promise<Project> {
    let project = this.projectsRepository.create({
      title: this.normalizeTitle(dto.title),
      contextAcademico: dto.contextAcademico?.trim() || null,
      status: dto.status ?? ProjectStatus.DRAFT,
      creatorId,
      maxDeliveriesPerStudent: dto.maxDeliveriesPerStudent ?? 1,
      expectedType: dto.expectedType?.trim() || null,
      rubricInstructions: dto.rubricInstructions?.trim() || null,
      opensAt: this.normalizeDateInput(dto.opensAt),
      closesAt: this.normalizeDateInput(dto.closesAt),
      teachers: [{ id: creatorId } as any],
    });
    this.assertProjectWindow(project.opensAt, project.closesAt);

    project = await this.projectsRepository.save(project);
    return this.projectRuntimeService.syncCreatedProject(project);
  }

  async update(
    id: string,
    dto: UpdateProjectDto,
    actor: AuthenticatedUser,
  ): Promise<Project> {
    const project = await this.projectAccessService.findOwnedProjectOrThrow(
      id,
      actor,
    );

    if (dto.title !== undefined) {
      project.title = this.normalizeTitle(dto.title);
    }

    if (dto.contextAcademico !== undefined) {
      project.contextAcademico = dto.contextAcademico.trim() || null;
    }

    if (dto.maxDeliveriesPerStudent !== undefined) {
      const maxIssuedVersion = await this.resolveMaxIssuedDeliveryVersion(id);
      if (dto.maxDeliveriesPerStudent < maxIssuedVersion) {
        throw new ConflictException(
          `No se puede reducir el cupo por debajo del mayor ordinal ya emitido (${maxIssuedVersion}).`,
        );
      }
      project.maxDeliveriesPerStudent = dto.maxDeliveriesPerStudent;
    }

    if (dto.expectedType !== undefined) {
      project.expectedType = dto.expectedType?.trim() || null;
    }

    if (dto.rubricInstructions !== undefined) {
      project.rubricInstructions = dto.rubricInstructions?.trim() || null;
    }

    if (dto.opensAt !== undefined) {
      project.opensAt = this.normalizeDateInput(dto.opensAt);
    }

    if (dto.closesAt !== undefined) {
      project.closesAt = this.normalizeDateInput(dto.closesAt);
    }

    this.assertProjectWindow(project.opensAt, project.closesAt);

    if (dto.status !== undefined) {
      return this.projectRuntimeService.transitionProjectStatus(
        project,
        dto.status,
      );
    }

    return this.projectsRepository.save(project);
  }

  async updateStatus(
    id: string,
    status: ProjectStatus,
    actor: AuthenticatedUser,
  ): Promise<Project> {
    const project = await this.projectAccessService.findOwnedProjectOrThrow(
      id,
      actor,
    );
    return this.projectRuntimeService.transitionProjectStatus(project, status);
  }

  async remove(id: string): Promise<{ message: string }> {
    const project = await this.projectAccessService.findProjectOrThrow(id);
    await this.projectsRepository.softRemove(project);
    return { message: 'Proyecto marcado como eliminado correctamente.' };
  }

  async restore(id: string): Promise<Project> {
    const project = await this.projectsRepository.findOne({
      where: { id },
      withDeleted: true,
    });
    if (!project) {
      throw new NotFoundException('No se encontro un proyecto con ese ID.');
    }

    if (!project.deletedAt) {
      throw new ConflictException('El proyecto ya se encuentra activo.');
    }

    await this.projectsRepository.recover(project);

    return this.projectAccessService.findProjectOrThrow(id);
  }

  async addTeacher(
    id: string,
    teacherId: string,
    actor: AuthenticatedUser,
  ): Promise<Project> {
    const project = await this.projectAccessService.findOwnedProjectOrThrow(
      id,
      actor,
    );
    const teachers = await this.projectsRepository
      .createQueryBuilder()
      .relation(Project, 'teachers')
      .of(project)
      .loadMany();

    if (teachers.some((t) => t.id === teacherId)) {
      return project;
    }

    await this.projectsRepository
      .createQueryBuilder()
      .relation(Project, 'teachers')
      .of(project)
      .add(teacherId);

    return this.projectAccessService.findProjectOrThrow(id);
  }

  async removeTeacher(
    id: string,
    teacherId: string,
    actor: AuthenticatedUser,
  ): Promise<Project> {
    const project = await this.projectAccessService.findOwnedProjectOrThrow(
      id,
      actor,
    );
    const teachers = await this.projectsRepository
      .createQueryBuilder()
      .relation(Project, 'teachers')
      .of(project)
      .loadMany();

    if (teachers.length <= 1) {
      throw new BadRequestException(
        'No se puede eliminar al único profesor asignado al proyecto.',
      );
    }

    await this.projectsRepository
      .createQueryBuilder()
      .relation(Project, 'teachers')
      .of(project)
      .remove(teacherId);

    return this.projectAccessService.findProjectOrThrow(id);
  }

  private async resolveMaxIssuedDeliveryVersion(
    projectId: string,
  ): Promise<number> {
    const row = await this.deliveriesRepository
      .createQueryBuilder('delivery')
      .withDeleted()
      .innerJoin(
        ProjectAssignment,
        'assignment',
        'assignment.id = delivery.assignmentId',
      )
      .select('MAX(delivery.version)', 'maxVersion')
      .where('assignment.projectId = :projectId', { projectId })
      .getRawOne<{ maxVersion: string | null }>();

    return Number.parseInt(row?.maxVersion ?? '0', 10) || 0;
  }

  private normalizeTitle(title: string): string {
    return title.trim();
  }

  private normalizeDateInput(value?: string | null): Date | null {
    const normalized = value?.trim();
    if (!normalized) {
      return null;
    }

    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Se recibió una fecha inválida.');
    }

    return parsed;
  }

  private assertProjectWindow(
    opensAt: Date | null,
    closesAt: Date | null,
  ): void {
    if (opensAt && closesAt && opensAt.getTime() > closesAt.getTime()) {
      throw new BadRequestException(
        'opensAt no puede ser posterior a closesAt.',
      );
    }
  }
}
