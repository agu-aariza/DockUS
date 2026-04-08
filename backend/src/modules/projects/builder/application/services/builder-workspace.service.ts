import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { access, mkdir, mkdtemp, writeFile } from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { Repository } from 'typeorm';
import {
  DEFAULT_MAX_EXTRACTED_BYTES,
  DEFAULT_MAX_EXTRACTED_FILES,
} from '../../domain/builder.constants';
import {
  ReproducibilitySnapshotInput,
  RuntimeFile,
} from '../../domain/builder.types';
import { StorageObject } from '../../../storage/entities/storage-object.entity';
import { MinioStorageService } from '../../../../../shared/infrastructure/storage/minio-storage.service';
import { extractArchiveToWorkspace } from '../../infrastructure/utils/archive-extractor.util';
import {
  buildSafeDestination,
  toPosixPath,
} from '../../infrastructure/utils/builder-analysis.util';

interface WorkspaceInputObject {
  storageObjectId: string;
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
  inputManifest: ReproducibilitySnapshotInput[];
  runtimeFiles: RuntimeFile[];
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
    const storageObjects = await this.storageRepository.find({
      where: { deliveryId },
      order: { createdAt: 'ASC' },
    });

    if (!storageObjects.length) {
      throw new NotFoundException(
        'La entrega no tiene artefactos para ejecutar builder.',
      );
    }

    return this.prepareWorkspaceFromInputs(
      storageObjects.map((item) => ({
        storageObjectId: item.id,
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

  async prepareWorkspaceFromSnapshot(
    inputManifest: ReproducibilitySnapshotInput[],
  ): Promise<StageWorkspaceResult> {
    return this.prepareWorkspaceFromInputs(
      inputManifest.map((item) => ({
        ...item,
        createdAt: new Date(item.createdAt),
      })),
    );
  }

  private async prepareWorkspaceFromInputs(
    inputObjects: WorkspaceInputObject[],
  ): Promise<StageWorkspaceResult> {
    if (!inputObjects.length) {
      throw new UnprocessableEntityException(
        'No se encontraron artefactos utilizables para preparar el workspace.',
      );
    }

    const workspaceRoot = await mkdtemp(
      path.join(os.tmpdir(), 'dockus-builder-'),
    );
    const projectRootDir = path.join(workspaceRoot, 'project');
    await mkdir(projectRootDir, { recursive: true });

    const warnings: string[] = [];
    const runtimeFiles: RuntimeFile[] = [];
    const counters = { files: 0, bytes: 0 };
    const archives = inputObjects.filter((item) =>
      this.isArchive(item.logicalName),
    );
    const regularFiles = inputObjects.filter(
      (item) => !this.isArchive(item.logicalName),
    );

    for (const archiveObject of archives) {
      const archiveBuffer = await this.fetchObjectBuffer(archiveObject);
      const extractedFiles = await extractArchiveToWorkspace({
        archiveName: archiveObject.logicalName,
        archiveBuffer,
        outputRootDir: projectRootDir,
        counters,
        limits: {
          maxFiles: this.maxExtractedFiles,
          maxBytes: this.maxExtractedBytes,
        },
      });
      runtimeFiles.push(...extractedFiles);
      warnings.push(
        `Se extrajo ${archiveObject.logicalName} (${extractedFiles.length} archivos).`,
      );
    }

    for (const fileObject of regularFiles) {
      const relativePath = this.resolveLogicalPath(
        fileObject.logicalPath,
        fileObject.logicalName,
      );
      const destination = buildSafeDestination(projectRootDir, relativePath);
      const objectBuffer = await this.fetchObjectBuffer(fileObject);
      counters.files += 1;
      counters.bytes += objectBuffer.length;
      this.assertExtractionWithinLimits(counters);

      if (await this.fileExists(destination)) {
        warnings.push(
          `El archivo ${relativePath} fue sobrescrito por artefacto subido individualmente.`,
        );
      }

      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, objectBuffer);
      runtimeFiles.push({
        relativePath: toPosixPath(path.relative(projectRootDir, destination)),
        absolutePath: destination,
        sizeBytes: objectBuffer.length,
      });
    }

    if (!runtimeFiles.length) {
      throw new UnprocessableEntityException(
        'No se encontraron archivos utilizables tras preparar artefactos.',
      );
    }

    return {
      inputManifest: inputObjects.map((item) => ({
        storageObjectId: item.storageObjectId,
        logicalName: item.logicalName,
        logicalPath: item.logicalPath,
        contentType: item.contentType,
        sizeBytes: item.sizeBytes,
        hash: item.hash,
        bucket: item.bucket,
        objectKey: item.objectKey,
        createdAt: item.createdAt.toISOString(),
      })),
      runtimeFiles,
      projectRootDir,
      warnings,
    };
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

  private toErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return 'Error no tipado en preparación de workspace.';
  }
}
