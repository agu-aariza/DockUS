/**
 * @fileoverview Servicio de seed para crear el usuario admin inicial.
 *
 * Contexto:
 * - Se ejecuta una vez al arrancar si no existe ningún admin.
 * - Usa las credenciales configuradas en las variables de entorno.
 *
 * @module AdminSeedService
 */

import { Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Logger } from 'nestjs-pino';
import * as bcrypt from 'bcrypt';
import {
  User,
  UserRole,
  UserStatus,
} from '../../../modules/users/entities/user.entity';
import { PROCESS_ROLE } from '../../../process-role.module';
import type { ProcessRole } from '../../../process-role.module';

const BCRYPT_SALT_ROUNDS = 10;

@Injectable()
export class AdminSeedService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
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

    await this.seedAdminIfAbsent();
  }

  /**
   * Crea un usuario admin si no existe ninguno en la base de datos.
   * Las credenciales se leen de SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD.
   */
  private async seedAdminIfAbsent(): Promise<void> {
    const existingAdmin = await this.usersRepository.findOne({
      where: { role: UserRole.ADMIN },
    });

    if (existingAdmin) {
      this.logger.log(
        `Admin existente detectado (${existingAdmin.email}). Seed omitido.`,
        AdminSeedService.name,
      );
      return;
    }

    const email = this.configService.get<string>('SEED_ADMIN_EMAIL');
    const password = this.configService.get<string>('SEED_ADMIN_PASSWORD');

    if (!email || !password) {
      this.logger.warn(
        'No hay admin en la BD y las variables SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD no están configuradas. ' +
          'La plataforma arrancará sin administrador. Configure las variables de entorno y reinicie.',
        AdminSeedService.name,
      );
      return;
    }

    if (password.length < 8) {
      this.logger.warn(
        'SEED_ADMIN_PASSWORD tiene menos de 8 caracteres. Seed de admin omitido por seguridad.',
        AdminSeedService.name,
      );
      return;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    const admin = this.usersRepository.create({
      email: email.trim().toLowerCase(),
      passwordHash,
      firstName: 'Admin',
      lastName: 'EduCodeAI',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    });

    try {
      await this.usersRepository.save(admin);
      this.logger.log(
        `Admin inicial creado: ${admin.email} (ID: ${admin.id})`,
        AdminSeedService.name,
      );
    } catch (error) {
      this.logger.error(
        `Error al crear admin inicial: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        undefined,
        AdminSeedService.name,
      );
    }
  }
}
