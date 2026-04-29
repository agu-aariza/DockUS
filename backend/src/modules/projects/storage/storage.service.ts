/**
 * @fileoverview Servicio de negocio para gestion de objetos en storage.
 *
 * Contexto:
 * - Orquesta upload a MinIO + persistencia de metadatos en BD.
 * - Distingue artefactos fuente del alumno y suites docentes por proyecto.
 *
 * @module StorageService
 */

import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { MinioStorageService } from '../../../shared/infrastructure/storage/minio-storage.service';
import { CreateStorageObjectDto } from './dto/create-storage-object.dto';
import { ListStorageObjectsQueryDto } from './dto/list-storage-objects-query.dto';
import { StorageAccessService } from './storage-access.service';
import { StorageQueryService } from './storage-query.service';
import { StorageUploadService } from './storage-upload.service';
import { StorageObject } from './entities/storage-object.entity';
import { UploadedStorageFile } from './interfaces/uploaded-storage-file.interface';
import {
  CreateDownloadUrlResponse,
  PaginatedStorageResponse,
  StorageObjectResponse,
} from './storage.types';
import { toStorageObjectResponse } from './storage-response.util';

export type {
  CreateDownloadUrlResponse,
  PaginatedStorageResponse,
  StorageObjectResponse,
} from './storage.types';

@Injectable()
export class StorageService {
  constructor(
    @InjectRepository(StorageObject)
    private readonly storageRepository: Repository<StorageObject>,
    private readonly minioStorageService: MinioStorageService,
    private readonly storageAccessService: StorageAccessService,
    private readonly storageQueryService: StorageQueryService,
    private readonly storageUploadService: StorageUploadService,
  ) {}

  async upload(
    dto: CreateStorageObjectDto,
    file: UploadedStorageFile | undefined,
    actor: AuthenticatedUser,
  ): Promise<StorageObjectResponse> {
    return this.storageUploadService.upload(dto, file, actor);
  }

  async uploadProjectTestSuite(
    projectId: string,
    file: UploadedStorageFile | undefined,
    actor: AuthenticatedUser,
  ): Promise<StorageObjectResponse> {
    return this.storageUploadService.uploadProjectTestSuite(
      projectId,
      file,
      actor,
    );
  }

  async findProjectTestSuite(
    projectId: string,
    actor: AuthenticatedUser,
  ): Promise<StorageObjectResponse> {
    return this.storageQueryService.findProjectTestSuite(projectId, actor);
  }

  async removeProjectTestSuite(
    projectId: string,
    actor: AuthenticatedUser,
  ): Promise<{ message: string }> {
    return this.storageUploadService.removeProjectTestSuite(
      projectId,
      actor,
      this.storageQueryService.findProjectTestSuiteEntity.bind(
        this.storageQueryService,
      ),
    );
  }

  async findAll(
    query: ListStorageObjectsQueryDto,
    actor: AuthenticatedUser,
  ): Promise<PaginatedStorageResponse> {
    return this.storageQueryService.findAll(query, actor);
  }

  async findOne(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<StorageObjectResponse> {
    return this.storageQueryService.findOne(id, actor);
  }

  async createDownloadUrl(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<CreateDownloadUrlResponse> {
    return this.storageQueryService.createDownloadUrl(id, actor);
  }

  async remove(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<{ message: string }> {
    this.storageAccessService.assertTeacherOrAdmin(
      actor,
      'No tiene permisos para eliminar objetos.',
    );
    const storageObject =
      await this.storageAccessService.findStorageObjectWithAccess(id, actor);
    await this.storageRepository.softRemove(storageObject);
    return {
      message: 'Objeto de storage marcado como eliminado correctamente.',
    };
  }

  async purge(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<{ message: string }> {
    this.storageAccessService.assertAdmin(
      actor,
      'Solo ADMIN puede purgar objetos fisicamente.',
    );
    const storageObject =
      await this.storageAccessService.findStorageObjectWithAccess(
        id,
        actor,
        true,
      );

    await this.minioStorageService.deleteObject(
      storageObject.bucket,
      storageObject.objectKey,
    );
    await this.storageRepository.delete({ id: storageObject.id });

    return { message: 'Objeto purgado fisicamente de forma correcta.' };
  }

  async restore(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<StorageObjectResponse> {
    this.storageAccessService.assertAdmin(
      actor,
      'Solo ADMIN puede restaurar objetos eliminados logicamente.',
    );
    const storageObject =
      await this.storageAccessService.findStorageObjectWithAccess(
        id,
        actor,
        true,
      );

    if (!storageObject.deletedAt) {
      throw new ConflictException('El objeto ya se encuentra activo.');
    }

    const exists = await this.minioStorageService.objectExists(
      storageObject.bucket,
      storageObject.objectKey,
    );
    if (!exists) {
      throw new NotFoundException(
        'No se puede restaurar: el objeto fisico no existe en storage.',
      );
    }

    await this.storageRepository.recover(storageObject);
    const restored =
      await this.storageAccessService.findStorageObjectWithAccess(id, actor);
    return toStorageObjectResponse(restored);
  }

  async findProjectTestSuiteStorage(
    projectId: string,
  ): Promise<StorageObject | null> {
    return this.storageQueryService.findProjectTestSuiteStorage(projectId);
  }
}
