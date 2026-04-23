/**
 * @fileoverview Preparación de workspaces efímeros para el builder.
 *
 * Contexto:
 * - Materializa artefactos de storage en un árbol temporal seguro.
 * - Fusiona código del alumno y suite docente preservando trazabilidad.
 *
 * @module BuilderWorkspaceService
 */

import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { access, chmod, mkdir, mkdtemp, writeFile } from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { Repository } from 'typeorm';
import {
  DEFAULT_MAX_EXTRACTED_BYTES,
  DEFAULT_MAX_EXTRACTED_FILES,
} from '../../domain/builder.constants';
import { RuntimeFile } from '../../domain/builder.types';
import { Delivery } from '../../../deliveries/entities/delivery.entity';
import { StorageObject } from '../../../storage/entities/storage-object.entity';
import {
  StorageAssetRole,
  StorageScopeType,
} from '../../../storage/entities/storage-object.entity';
import { MinioStorageService } from '../../../../../shared/infrastructure/storage/minio-storage.service';
import { extractArchiveToWorkspace } from '../../infrastructure/utils/archive-extractor.util';
import {
  buildSafeDestination,
  toPosixPath,
} from '../../infrastructure/utils/builder-analysis.util';

interface WorkspaceInputObject {
  storageObjectId: string;
  scopeType: 'DELIVERY' | 'PROJECT';
  scopeId: string;
  assetRole: 'STUDENT_SOURCE' | 'TEACHER_TESTS';
  projectId: string | null;
  deliveryId: string | null;
  logicalName: string;
  logicalPath: string;
  contentType: string;
  sizeBytes: number;
  hash: string;
  bucket: string;
  objectKey: string;
  createdAt: Date;
}

export interface StageWorkspaceResult {
  inputManifest: unknown[];
  runtimeFiles: RuntimeFile[];
  teacherTestRuntimeFiles: RuntimeFile[];
  hasTeacherTests: boolean;
  projectRootDir: string;
  warnings: string[];
}

@Injectable()
export class BuilderWorkspaceService {
  private readonly maxExtractedFiles: number;
  private readonly maxExtractedBytes: number;

  constructor(
    @InjectRepository(StorageObject)
    private readonly storageRepository: Repository<StorageObject>,
    @InjectRepository(Delivery)
    private readonly deliveriesRepository: Repository<Delivery>,
    private readonly minioStorageService: MinioStorageService,
    private readonly configService: ConfigService,
  ) {
    this.maxExtractedFiles = this.configService.get<number>(
      'BUILDER_MAX_EXTRACTED_FILES',
      DEFAULT_MAX_EXTRACTED_FILES,
    );
    this.maxExtractedBytes = this.configService.get<number>(
      'BUILDER_MAX_EXTRACTED_BYTES',
      DEFAULT_MAX_EXTRACTED_BYTES,
    );
  }

  async prepareWorkspace(deliveryId: string): Promise<StageWorkspaceResult> {
    const delivery = await this.deliveriesRepository.findOne({
      where: { id: deliveryId },
      relations: {
        assignment: {
          project: true,
        },
      },
    });
    if (!delivery) {
      throw new NotFoundException(
        'Entrega no encontrada para preparar workspace.',
      );
    }

    const studentSourceObjects = await this.storageRepository.find({
      where: {
        scopeType: StorageScopeType.DELIVERY,
        scopeId: deliveryId,
        assetRole: StorageAssetRole.STUDENT_SOURCE,
      },
      order: { createdAt: 'ASC' },
    });

    if (!studentSourceObjects.length) {
      throw new NotFoundException(
        'La entrega no tiene artefactos fuente del alumno para ejecutar builder.',
      );
    }

    const teacherTestObjects = await this.storageRepository.find({
      where: {
        scopeType: StorageScopeType.PROJECT,
        scopeId: delivery.assignment.projectId,
        assetRole: StorageAssetRole.TEACHER_TESTS,
      },
      order: { createdAt: 'DESC' },
      take: 1,
    });

    return this.prepareWorkspaceFromInputs(
      studentSourceObjects.map((item) => ({
        storageObjectId: item.id,
        scopeType: item.scopeType,
        scopeId: item.scopeId,
        assetRole: item.assetRole,
        projectId: item.projectId,
        deliveryId: item.deliveryId,
        logicalName: item.logicalName,
        logicalPath: item.logicalPath,
        contentType: item.contentType,
        sizeBytes: item.sizeBytes,
        hash: item.hash,
        bucket: item.bucket,
        objectKey: item.objectKey,
        createdAt: item.createdAt,
      })),
      teacherTestObjects.map((item) => ({
        storageObjectId: item.id,
        scopeType: item.scopeType,
        scopeId: item.scopeId,
        assetRole: item.assetRole,
        projectId: item.projectId,
        deliveryId: item.deliveryId,
        logicalName: item.logicalName,
        logicalPath: item.logicalPath,
        contentType: item.contentType,
        sizeBytes: item.sizeBytes,
        hash: item.hash,
        bucket: item.bucket,
        objectKey: item.objectKey,
        createdAt: item.createdAt,
      })),
    );
  }

  private async prepareWorkspaceFromInputs(
    studentInputObjects: WorkspaceInputObject[],
    teacherTestObjects: WorkspaceInputObject[],
  ): Promise<StageWorkspaceResult> {
    if (!studentInputObjects.length) {
      throw new UnprocessableEntityException(
        'No se encontraron artefactos utilizables para preparar el workspace.',
      );
    }

    const workspaceRoot = await mkdtemp(
      path.join(os.tmpdir(), 'dockus-builder-'),
    );
    const projectRootDir = path.join(workspaceRoot, 'project');
    await mkdir(projectRootDir, { recursive: true });
    const teacherTestsRootDir = path.join(
      projectRootDir,
      '.dockus',
      'teacher-tests',
    );
    await mkdir(teacherTestsRootDir, { recursive: true });

    const warnings: string[] = [];
    const runtimeFiles: RuntimeFile[] = [];
    const teacherTestRuntimeFiles: RuntimeFile[] = [];
    const counters = { files: 0, bytes: 0 };
    await this.materializeInputObjects({
      inputObjects: studentInputObjects,
      outputRootDir: projectRootDir,
      projectRootDir,
      counters,
      warnings,
      runtimeFiles,
      mode: 'student_source',
    });
    await this.materializeInputObjects({
      inputObjects: teacherTestObjects,
      outputRootDir: teacherTestsRootDir,
      projectRootDir,
      counters,
      warnings,
      runtimeFiles: teacherTestRuntimeFiles,
      mode: 'teacher_tests',
    });
    await this.makeReadOnly(teacherTestsRootDir, teacherTestRuntimeFiles);

    if (!runtimeFiles.length) {
      throw new UnprocessableEntityException(
        'No se encontraron archivos utilizables tras preparar artefactos.',
      );
    }

    return {
      inputManifest: [...studentInputObjects, ...teacherTestObjects].map(
        (item) => ({
          storageObjectId: item.storageObjectId,
          scopeType: item.scopeType,
          scopeId: item.scopeId,
          assetRole: item.assetRole,
          projectId: item.projectId,
          deliveryId: item.deliveryId,
          logicalName: item.logicalName,
          logicalPath: item.logicalPath,
          contentType: item.contentType,
          sizeBytes: item.sizeBytes,
          hash: item.hash,
          bucket: item.bucket,
          objectKey: item.objectKey,
          createdAt: item.createdAt.toISOString(),
        }),
      ),
      runtimeFiles,
      teacherTestRuntimeFiles,
      hasTeacherTests: teacherTestRuntimeFiles.length > 0,
      projectRootDir,
      warnings,
    };
  }

  private async materializeInputObjects(input: {
    inputObjects: WorkspaceInputObject[];
    outputRootDir: string;
    projectRootDir: string;
    counters: { files: number; bytes: number };
    warnings: string[];
    runtimeFiles: RuntimeFile[];
    mode: 'student_source' | 'teacher_tests';
  }): Promise<void> {
    const archives = input.inputObjects.filter((item) =>
      this.isArchive(item.logicalName),
    );
    const regularFiles = input.inputObjects.filter(
      (item) => !this.isArchive(item.logicalName),
    );

    for (const archiveObject of archives) {
      // Los comprimidos se expanden con límites estrictos para prevenir bomb
      // files y mantener el workspace dentro de los umbrales configurados.
      const archiveBuffer = await this.fetchObjectBuffer(archiveObject);
      const extractedFiles = await extractArchiveToWorkspace({
        archiveName: archiveObject.logicalName,
        archiveBuffer,
        outputRootDir: input.outputRootDir,
        counters: input.counters,
        limits: {
          maxFiles: this.maxExtractedFiles,
          maxBytes: this.maxExtractedBytes,
        },
      });
      input.runtimeFiles.push(...extractedFiles);
      input.warnings.push(
        input.mode === 'teacher_tests'
          ? `Se extrajo suite docente ${archiveObject.logicalName} (${extractedFiles.length} archivos).`
          : `Se extrajo ${archiveObject.logicalName} (${extractedFiles.length} archivos).`,
      );
    }

    for (const fileObject of regularFiles) {
      const relativePath =
        input.mode === 'teacher_tests'
          ? path.posix.basename(toPosixPath(fileObject.logicalName).trim())
          : this.resolveLogicalPath(
              fileObject.logicalPath,
              fileObject.logicalName,
            );
      const destination = buildSafeDestination(
        input.outputRootDir,
        relativePath,
      );
      const objectBuffer = await this.fetchObjectBuffer(fileObject);
      input.counters.files += 1;
      input.counters.bytes += objectBuffer.length;
      this.assertExtractionWithinLimits(input.counters);

      if (await this.fileExists(destination)) {
        input.warnings.push(
          input.mode === 'teacher_tests'
            ? `La suite docente sobrescribió ${relativePath}.`
            : `El archivo ${relativePath} fue sobrescrito por artefacto subido individualmente.`,
        );
      }

      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, objectBuffer);
      input.runtimeFiles.push({
        relativePath: toPosixPath(
          path.relative(input.projectRootDir, destination),
        ),
        absolutePath: destination,
        sizeBytes: objectBuffer.length,
      });
    }
  }

  private async fetchObjectBuffer(
    inputObject: WorkspaceInputObject,
  ): Promise<Buffer> {
    try {
      return await this.minioStorageService.getObjectBuffer(
        inputObject.bucket,
        inputObject.objectKey,
      );
    } catch (error) {
      throw new UnprocessableEntityException(
        `No se pudo leer el objeto ${inputObject.storageObjectId}: ${this.toErrorMessage(error)}`,
      );
    }
  }

  private resolveLogicalPath(logicalPath: string, logicalName: string): string {
    const normalizedPath = toPosixPath(logicalPath).trim();
    if (normalizedPath && !/^[A-Za-z]:\//.test(normalizedPath)) {
      return normalizedPath.replace(/^\.?\//, '');
    }

    const fallbackName = path.posix.basename(toPosixPath(logicalName).trim());
    if (!fallbackName) {
      throw new UnprocessableEntityException(
        'No se pudo determinar la ruta relativa del artefacto en storage.',
      );
    }

    return fallbackName;
  }

  private isArchive(fileName: string): boolean {
    const normalized = fileName.toLowerCase();
    return normalized.endsWith('.zip') || normalized.endsWith('.tar.gz');
  }

  private assertExtractionWithinLimits(counters: {
    files: number;
    bytes: number;
  }): void {
    if (counters.files > this.maxExtractedFiles) {
      throw new UnprocessableEntityException(
        `Limite de archivos extraidos excedido (${this.maxExtractedFiles}).`,
      );
    }
    if (counters.bytes > this.maxExtractedBytes) {
      throw new UnprocessableEntityException(
        `Limite de bytes extraidos excedido (${this.maxExtractedBytes}).`,
      );
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async makeReadOnly(
    rootDir: string,
    runtimeFiles: RuntimeFile[],
  ): Promise<void> {
    if (!runtimeFiles.length) {
      return;
    }

    await Promise.all(
      runtimeFiles.map((runtimeFile) => chmod(runtimeFile.absolutePath, 0o444)),
    );
    await chmod(rootDir, 0o555).catch(() => undefined);
  }

  private toErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return 'Error no tipado en preparación de workspace.';
  }
}
