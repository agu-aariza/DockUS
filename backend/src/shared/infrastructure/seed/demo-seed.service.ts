/**
 * @fileoverview Componente de infraestructura compartida (demo-seed.service).
 *
 * @module demo-seed.service
 */

import { Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Logger } from 'nestjs-pino';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import {
  User,
  UserRole,
  UserStatus,
} from '../../../modules/users/entities/user.entity';
import {
  Project,
  ProjectStatus,
} from '../../../modules/projects/entities/project.entity';
import { ProjectAssignment } from '../../../modules/projects/assignments/entities/project-assignment.entity';
import {
  Delivery,
  DeliveryStatus,
} from '../../../modules/projects/deliveries/entities/delivery.entity';
import { PROCESS_ROLE } from '../../../process-role.module';
import type { ProcessRole } from '../../../process-role.module';

const BCRYPT_SALT_ROUNDS = 10;

function isEnabled(value: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes((value ?? '').toLowerCase());
}

@Injectable()
export class DemoSeedService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
    @InjectRepository(ProjectAssignment)
    private readonly assignmentsRepository: Repository<ProjectAssignment>,
    @InjectRepository(Delivery)
    private readonly deliveriesRepository: Repository<Delivery>,
    private readonly configService: ConfigService,
    private readonly logger: Logger,
    @Inject(PROCESS_ROLE)
    private readonly processRole: ProcessRole,
  ) {}

  /** El worker no siembra: solo la API arranca de cara a un operador humano. */
  async onApplicationBootstrap(): Promise<void> {
    if (this.processRole !== 'api') {
      return;
    }

    if (!isEnabled(this.configService.get<string>('SEED_DEMO_DATA'))) {
      return;
    }

    await this.seedDemoWorkspace();
  }

  private async seedDemoWorkspace(): Promise<void> {
    const demoTeacherEmail = 'teacher@dockus.local';
    const existingTeacher = await this.usersRepository.findOne({
      where: { email: demoTeacherEmail },
      withDeleted: true,
    });

    if (existingTeacher) {
      this.logger.log(
        'Seed demo omitido: ya existe el profesor demo.',
        DemoSeedService.name,
      );
      return;
    }

    const demoPassword =
      this.configService.get<string>('SEED_DEMO_PASSWORD') ?? 'Dockus1234!';
    const passwordHash = await bcrypt.hash(demoPassword, BCRYPT_SALT_ROUNDS);

    const teacher = await this.usersRepository.save(
      this.usersRepository.create({
        email: demoTeacherEmail,
        passwordHash,
        firstName: 'Clara',
        lastName: 'Docente',
        role: UserRole.TEACHER,
        status: UserStatus.ACTIVE,
      }),
    );

    const students = await this.usersRepository.save([
      this.usersRepository.create({
        email: 'alumno1@dockus.local',
        passwordHash,
        firstName: 'Lucía',
        lastName: 'Pérez',
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
      }),
      this.usersRepository.create({
        email: 'alumno2@dockus.local',
        passwordHash,
        firstName: 'Mario',
        lastName: 'Ruiz',
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
      }),
      this.usersRepository.create({
        email: 'alumno3@dockus.local',
        passwordHash,
        firstName: 'Sara',
        lastName: 'Gil',
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
      }),
    ]);

    const now = new Date();
    const flaskProject = await this.projectsRepository.save(
      this.projectsRepository.create({
        title: 'Práctica 1: Flask API',
        contextAcademico:
          'API REST básica con Flask, pruebas automáticas y estructura Python-first.',
        maxDeliveriesPerStudent: 3,
        status: ProjectStatus.ACTIVE,
        creatorId: teacher.id,
        expectedType: 'Flask API',
        rubricInstructions:
          'Valora arranque correcto, rutas mínimas, organización del código y robustez frente a errores.',
        rubricCriteria: [
          {
            name: 'Arranque y rutas funcionales',
            weight: 50,
            description:
              'La API arranca y las rutas mínimas responden con los códigos y cuerpos esperados.',
          },
          {
            name: 'Organización del código',
            weight: 30,
            description:
              'Separación en módulos, nombres claros y ausencia de duplicación evidente.',
          },
          {
            name: 'Robustez frente a errores',
            weight: 20,
            description:
              'Manejo de entradas inválidas y respuestas de error controladas.',
          },
        ],
        opensAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
        closesAt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
      }),
    );

    await this.projectsRepository.save(
      this.projectsRepository.create({
        title: 'Práctica 2: CLI Python',
        contextAcademico:
          'Herramienta de línea de comandos con entrada por argumentos y salida estructurada.',
        maxDeliveriesPerStudent: 2,
        status: ProjectStatus.DRAFT,
        creatorId: teacher.id,
        expectedType: 'CLI Python',
        rubricInstructions:
          'Comprueba parseo de argumentos, mensajes de ayuda y organización del módulo principal.',
        opensAt: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
        closesAt: new Date(now.getTime() + 9 * 24 * 60 * 60 * 1000),
      }),
    );

    const assignments = await this.assignmentsRepository.save(
      students.map((student, index) =>
        this.assignmentsRepository.create({
          projectId: flaskProject.id,
          studentId: student.id,
          assignedById: teacher.id,
          assignedAt: new Date(now.getTime() - (index + 1) * 60 * 60 * 1000),
          revokedAt: null,
        }),
      ),
    );

    // No groups seeded. Alumnos assigned directly to project.

    await this.deliveriesRepository.save([
      this.deliveriesRepository.create({
        assignmentId: assignments[0].id,
        authorId: students[0].id,
        version: 1,
        status: DeliveryStatus.EVALUATED,
        notes: 'Entrega inicial con API funcional.',
        isLate: false,
        grade: 9.2,
        graderNotes:
          'Buen trabajo general. Solo faltó documentar mejor los errores HTTP.',
      }),
      this.deliveriesRepository.create({
        assignmentId: assignments[1].id,
        authorId: students[1].id,
        version: 1,
        status: DeliveryStatus.IN_REVIEW,
        notes: 'Pendiente de builder.',
        isLate: false,
        grade: null,
        graderNotes: null,
      }),
      this.deliveriesRepository.create({
        assignmentId: assignments[2].id,
        authorId: students[2].id,
        version: 1,
        status: DeliveryStatus.SUBMITTED,
        notes: 'Versión subida fuera de plazo.',
        isLate: true,
        grade: null,
        graderNotes: null,
      }),
    ]);

    this.logger.log(
      'Seed demo completado: profesor, alumnado, proyectos y entregas de ejemplo creados.',
      DemoSeedService.name,
    );
  }
}
