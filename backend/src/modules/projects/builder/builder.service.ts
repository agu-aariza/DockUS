/**
 * @fileoverview Servicio de Builder MVP para analisis Python y build Docker.
 *
 * Contexto:
 * - Recupera artefactos de una entrega y prepara workspace temporal.
 * - Detecta stack Python, bloquea rutas absolutas y genera Dockerfile con SLM.
 * - Ejecuta docker build real y devuelve resultado completo en JSON.
 *
 * @module BuilderService
 */

import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { Repository } from 'typeorm';
import { MinioStorageService } from '../../../shared/infrastructure/storage/minio-storage.service';
import { toBoolean } from '../../../shared/utils/to-boolean.util';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../../users/entities/user.entity';
import { Delivery } from '../deliveries/entities/delivery.entity';
import { StorageObject } from '../storage/entities/storage-object.entity';
import {
  DEFAULT_BUILDER_CLEANUP_IMAGES,
  DEFAULT_DOCKER_BUILD_TIMEOUT_MS,
  DEFAULT_DOCKER_CHECK_TIMEOUT_MS,
  DEFAULT_LOG_TAIL_LINES,
  DEFAULT_MAX_EXTRACTED_BYTES,
  DEFAULT_MAX_EXTRACTED_FILES,
  DEFAULT_OLLAMA_BASE_URL,
  DEFAULT_OLLAMA_MODEL,
  DEFAULT_OLLAMA_TIMEOUT_MS,
  DEFAULT_PROMPT_MAX_CHARS,
  DEFAULT_PYTHON_VERSION,
  DOCKERFILE_SYSTEM_PROMPT,
  QUALITY_SYSTEM_PROMPT,
} from './builder.constants';
import {
  BuilderQualityResult,
  BuilderRunResponse,
  RuntimeFile,
} from './builder.types';
import {
  buildSafeDestination,
  detectPythonProjectContext,
  normalizeDockerfileResponse,
  parseQualityResponse,
  scanAbsolutePathsInFiles,
  toPosixPath,
} from './utils/builder-analysis.util';
import { extractArchiveToWorkspace } from './utils/archive-extractor.util';
import {
  buildLogTail,
  CommandRunResult,
  runCommand,
} from './utils/command-runner.util';

interface StageResult {
  runtimeFiles: RuntimeFile[];
  projectRootDir: string;
  warnings: string[];
}

@Injectable()
export class BuilderService {
  private readonly ollamaBaseUrl: string;
  private readonly ollamaModel: string;
  private readonly ollamaTimeoutMs: number;
  private readonly dockerBuildTimeoutMs: number;
  private readonly cleanupImages: boolean;
  private readonly defaultPythonVersion: string;
  private readonly maxExtractedFiles: number;
  private readonly maxExtractedBytes: number;
  private readonly promptMaxChars: number;

  constructor(
    @InjectRepository(Delivery)
    private readonly deliveriesRepository: Repository<Delivery>,
    @InjectRepository(StorageObject)
    private readonly storageRepository: Repository<StorageObject>,
    private readonly minioStorageService: MinioStorageService,
    private readonly configService: ConfigService,
  ) {
    this.ollamaBaseUrl = this.configService.get<string>(
      'BUILDER_OLLAMA_BASE_URL',
      DEFAULT_OLLAMA_BASE_URL,
    );
    this.ollamaModel = this.configService.get<string>(
      'BUILDER_OLLAMA_MODEL',
      DEFAULT_OLLAMA_MODEL,
    );
    this.ollamaTimeoutMs = this.configService.get<number>(
      'BUILDER_OLLAMA_TIMEOUT_MS',
      DEFAULT_OLLAMA_TIMEOUT_MS,
    );
    this.dockerBuildTimeoutMs = this.configService.get<number>(
      'BUILDER_DOCKER_BUILD_TIMEOUT_MS',
      DEFAULT_DOCKER_BUILD_TIMEOUT_MS,
    );
    this.cleanupImages = toBoolean(
      this.configService.get<string | boolean>(
        'BUILDER_CLEANUP_IMAGES',
        DEFAULT_BUILDER_CLEANUP_IMAGES,
      ),
    );
    this.defaultPythonVersion = this.configService.get<string>(
      'BUILDER_DEFAULT_PYTHON_VERSION',
      DEFAULT_PYTHON_VERSION,
    );
    this.maxExtractedFiles = this.configService.get<number>(
      'BUILDER_MAX_EXTRACTED_FILES',
      DEFAULT_MAX_EXTRACTED_FILES,
    );
    this.maxExtractedBytes = this.configService.get<number>(
      'BUILDER_MAX_EXTRACTED_BYTES',
      DEFAULT_MAX_EXTRACTED_BYTES,
    );
    this.promptMaxChars = this.configService.get<number>(
      'BUILDER_PROMPT_MAX_CHARS',
      DEFAULT_PROMPT_MAX_CHARS,
    );
  }

  async runDeliveryBuilder(
    deliveryId: string,
    actor: AuthenticatedUser,
  ): Promise<BuilderRunResponse> {
    const startedAt = Date.now();
    const timings = {
      collect: 0,
      detect: 0,
      scan: 0,
      dockerfile: 0,
      quality: 0,
      build: 0,
      total: 0,
    };
    const warnings: string[] = [];
    let workspaceRootDir: string | null = null;
    let buildImageTag = '';

    try {
      const collectStartedAt = Date.now();
      const delivery = await this.findDeliveryOrThrow(deliveryId);
      this.assertCanAccessDelivery(delivery, actor);
      const stageResult = await this.prepareWorkspace(delivery.id);
      workspaceRootDir = path.dirname(stageResult.projectRootDir);
      warnings.push(...stageResult.warnings);
      timings.collect = Date.now() - collectStartedAt;

      const detectStartedAt = Date.now();
      const detectContext = await detectPythonProjectContext(
        stageResult.runtimeFiles,
        this.defaultPythonVersion,
      );
      warnings.push(...detectContext.warnings);
      timings.detect = Date.now() - detectStartedAt;

      const scanStartedAt = Date.now();
      const absolutePathFindings = await scanAbsolutePathsInFiles(
        stageResult.runtimeFiles,
      );
      timings.scan = Date.now() - scanStartedAt;
      if (absolutePathFindings.length > 0) {
        throw new UnprocessableEntityException({
          message:
            'Aviso: Se detectaron rutas locales absolutas. Usa rutas relativas para un build reproducible.',
          findings: absolutePathFindings,
        });
      }

      const dockerPromptStartedAt = Date.now();
      const dockerPrompt = this.buildDockerfilePrompt(
        detectContext.stack.pythonVersion,
        detectContext.stack.manifests.requirementsTxt,
        detectContext.stack.manifests.pyprojectToml,
        detectContext.stack.entrypoint,
        this.collectRootFiles(stageResult.runtimeFiles),
      );
      const dockerfileContent = await this.generateDockerfile(dockerPrompt);
      await writeFile(
        path.join(stageResult.projectRootDir, 'Dockerfile'),
        dockerfileContent,
        'utf8',
      );
      timings.dockerfile = Date.now() - dockerPromptStartedAt;

      const qualityStartedAt = Date.now();
      const qualityPrompt = await this.buildQualityPrompt(
        stageResult.runtimeFiles,
        warnings,
      );
      const qualityResult = await this.generateQualityResult(qualityPrompt);
      timings.quality = Date.now() - qualityStartedAt;

      const buildStartedAt = Date.now();
      await this.assertDockerAvailable();
      buildImageTag = this.createImageTag(delivery.id);
      const buildResult = await this.runDockerBuild(
        stageResult.projectRootDir,
        buildImageTag,
      );
      timings.build = Date.now() - buildStartedAt;

      timings.total = Date.now() - startedAt;
      return {
        deliveryId: delivery.id,
        pipelineStatus: buildResult.exitCode === 0 ? 'SUCCESS' : 'BUILD_FAILED',
        stack: detectContext.stack,
        absolutePathScan: {
          blocked: false,
          findings: [],
        },
        dockerfile: {
          model: this.ollamaModel,
          content: dockerfileContent,
        },
        build: {
          tag: buildImageTag,
          exitCode: buildResult.exitCode,
          durationMs: buildResult.durationMs,
          logsTail: buildResult.logsTail,
        },
        quality: qualityResult,
        timingsMs: timings,
        warnings,
      };
    } finally {
      if (buildImageTag && this.cleanupImages) {
        await this.cleanupImage(buildImageTag, warnings);
      }

      if (workspaceRootDir) {
        await rm(workspaceRootDir, { recursive: true, force: true });
      }
    }
  }

  private async findDeliveryOrThrow(deliveryId: string): Promise<Delivery> {
    const delivery = await this.deliveriesRepository.findOne({
      where: { id: deliveryId },
    });
    if (!delivery) {
      throw new NotFoundException(
        'Entrega no encontrada para ejecutar builder MVP.',
      );
    }

    return delivery;
  }

  private assertCanAccessDelivery(
    delivery: Delivery,
    actor: AuthenticatedUser,
  ): void {
    if (actor.role === UserRole.STUDENT && delivery.authorId !== actor.userId) {
      throw new ForbiddenException(
        'No tiene permisos para ejecutar builder sobre una entrega ajena.',
      );
    }
  }

  private async prepareWorkspace(deliveryId: string): Promise<StageResult> {
    const storageObjects = await this.storageRepository.find({
      where: { deliveryId },
      order: { createdAt: 'ASC' },
    });

    if (!storageObjects.length) {
      throw new NotFoundException(
        'La entrega no tiene artefactos para ejecutar builder.',
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
    const archives = storageObjects.filter((item) =>
      this.isArchive(item.logicalName),
    );
    const regularFiles = storageObjects.filter(
      (item) => !this.isArchive(item.logicalName),
    );

    for (const archiveObject of archives) {
      const archiveBuffer = await this.minioStorageService.getObjectBuffer(
        archiveObject.bucket,
        archiveObject.objectKey,
      );
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
      const objectBuffer = await this.minioStorageService.getObjectBuffer(
        fileObject.bucket,
        fileObject.objectKey,
      );

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
        'No se encontraron archivos utilizables tras preparar los artefactos.',
      );
    }

    return { runtimeFiles, projectRootDir, warnings };
  }

  private buildDockerfilePrompt(
    pythonVersion: string,
    requirementsPath: string | null,
    pyprojectPath: string | null,
    entrypoint: string,
    rootFilesCsv: string,
  ): string {
    const hasRequirements = Boolean(requirementsPath);
    const hasPyproject = Boolean(pyprojectPath);
    const resolvedVersion = pythonVersion || this.defaultPythonVersion;

    return [
      'Genera un Dockerfile optimizado y reproducible para este proyecto Python.',
      '',
      'Datos detectados:',
      `- python_version: ${pythonVersion || '(sin detectar)'}`,
      `- entrypoint: ${entrypoint}`,
      `- has_requirements_txt: ${hasRequirements}`,
      `- has_pyproject_toml: ${hasPyproject}`,
      `- project_root_files: ${rootFilesCsv || '(none)'}`,
      '',
      'Reglas obligatorias:',
      `1) FROM python:${resolvedVersion}-slim`,
      '2) WORKDIR /app',
      '3) Copiar primero manifiestos de dependencias antes del resto del codigo.',
      '4) Si existe requirements.txt: instalar con pip install --no-cache-dir -r requirements.txt',
      '5) Si solo existe pyproject.toml y no requirements.txt: instalar con pip install --no-cache-dir .',
      '6) Copiar el codigo fuente al contenedor.',
      '7) Definir CMD para ejecutar el entrypoint detectado.',
      '8) No usar rutas absolutas del host.',
      '9) Mantener el Dockerfile minimalista y valido para docker build.',
      '',
      'Devuelve SOLO el Dockerfile final.',
    ].join('\n');
  }

  private async buildQualityPrompt(
    runtimeFiles: RuntimeFile[],
    warnings: string[],
  ): Promise<string> {
    const pythonFiles = runtimeFiles
      .filter((file) => file.relativePath.toLowerCase().endsWith('.py'))
      .sort((a, b) => a.relativePath.localeCompare(b.relativePath));

    const sourceParts: string[] = [];
    for (const file of pythonFiles) {
      const content = await this.readTextFile(file.absolutePath);
      sourceParts.push(`### FILE: ${file.relativePath}\n${content}`);
    }

    let concatenatedSource = sourceParts.join('\n\n');
    if (concatenatedSource.length > this.promptMaxChars) {
      warnings.push(
        `El contexto de calidad superaba ${this.promptMaxChars} caracteres y fue truncado.`,
      );
      concatenatedSource = concatenatedSource.slice(0, this.promptMaxChars);
    }

    return [
      'Analiza el siguiente codigo Python y clasifica los constructores de cada clase.',
      '',
      'Definiciones:',
      '- "parametrized": la clase define __init__ con al menos un argumento ademas de self.',
      '- "non-parametrized": la clase define __init__(self) sin argumentos adicionales.',
      '- "implicit": la clase no define __init__ explicito.',
      '',
      'Schema de salida obligatorio:',
      '{',
      '  "classes": [',
      '    {',
      '      "name": "string",',
      '      "constructor": "parametrized|non-parametrized|implicit",',
      '      "issues": ["string"]',
      '    }',
      '  ],',
      '  "summary": "string"',
      '}',
      '',
      'Codigo:',
      concatenatedSource,
      '',
      'Reglas:',
      '- Devuelve JSON estricto con exactamente las claves "classes" y "summary".',
      '- No incluyas claves extra fuera de ese schema.',
      '- "issues" debe existir siempre (puede ser []).',
    ].join('\n');
  }

  private async generateDockerfile(prompt: string): Promise<string> {
    return this.generateWithValidation(
      'dockerfile',
      DOCKERFILE_SYSTEM_PROMPT,
      prompt,
      (output) => normalizeDockerfileResponse(output),
    );
  }

  private async generateQualityResult(
    prompt: string,
  ): Promise<BuilderQualityResult> {
    return this.generateWithValidation(
      'quality',
      QUALITY_SYSTEM_PROMPT,
      prompt,
      (output) => parseQualityResponse(output),
    );
  }

  private async generateWithValidation<T>(
    taskName: string,
    systemPrompt: string,
    userPrompt: string,
    parser: (output: string) => T,
  ): Promise<T> {
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const rawResponse = await this.runOllamaPrompt(
          systemPrompt,
          userPrompt,
        );
        return parser(rawResponse);
      } catch (error) {
        lastError = error;
      }
    }

    const message =
      lastError instanceof Error ? lastError.message : 'Error desconocido.';
    throw new ServiceUnavailableException(
      `No se pudo obtener una salida valida de Ollama para ${taskName}: ${message}`,
    );
  }

  private async runOllamaPrompt(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.ollamaTimeoutMs);

    try {
      const response = await fetch(`${this.ollamaBaseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.ollamaModel,
          system: systemPrompt,
          prompt: userPrompt,
          stream: false,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorPayload = await response.text();
        throw new ServiceUnavailableException(
          `Ollama respondio ${response.status}: ${errorPayload.slice(0, 300)}`,
        );
      }

      const payload = (await response.json()) as {
        response?: unknown;
        error?: unknown;
      };
      if (typeof payload.response !== 'string') {
        throw new ServiceUnavailableException(
          'Ollama no devolvio el campo response esperado.',
        );
      }

      return payload.response;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new ServiceUnavailableException(
          `Timeout agotado al consultar Ollama (${this.ollamaTimeoutMs} ms).`,
        );
      }

      const message =
        error instanceof Error ? error.message : 'Error desconocido de red.';
      throw new ServiceUnavailableException(
        `No se pudo conectar con Ollama en ${this.ollamaBaseUrl}: ${message}`,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private async assertDockerAvailable(): Promise<void> {
    try {
      const result = await runCommand(
        'docker',
        ['info', '--format', '{{.ServerVersion}}'],
        {
          timeoutMs: DEFAULT_DOCKER_CHECK_TIMEOUT_MS,
        },
      );

      if (result.timedOut || result.exitCode !== 0 || !result.stdout.trim()) {
        throw new ServiceUnavailableException(
          `Docker daemon no disponible: ${result.stderr.trim() || 'sin detalle de error.'}`,
        );
      }
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      const message =
        error instanceof Error ? error.message : 'Error desconocido de Docker.';
      throw new ServiceUnavailableException(
        `No se pudo ejecutar docker info: ${message}`,
      );
    }
  }

  private async runDockerBuild(
    projectRootDir: string,
    imageTag: string,
  ): Promise<{
    exitCode: number;
    durationMs: number;
    logsTail: string[];
  }> {
    const startedAt = Date.now();
    let result: CommandRunResult | null = null;
    try {
      result = await runCommand('docker', ['build', '-t', imageTag, '.'], {
        cwd: projectRootDir,
        timeoutMs: this.dockerBuildTimeoutMs,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Error desconocido.';
      throw new ServiceUnavailableException(
        `No se pudo ejecutar docker build: ${message}`,
      );
    }

    if (!result) {
      throw new ServiceUnavailableException(
        'No se obtuvo resultado de docker build.',
      );
    }

    const combinedLogs = `${result.stdout}\n${result.stderr}`.trim();
    const logsTail = buildLogTail(combinedLogs, DEFAULT_LOG_TAIL_LINES);

    if (this.isDockerInfrastructureError(combinedLogs)) {
      throw new ServiceUnavailableException(
        'Docker daemon no disponible durante docker build.',
      );
    }

    return {
      exitCode: result.timedOut ? -1 : result.exitCode,
      durationMs: Date.now() - startedAt,
      logsTail,
    };
  }

  private async cleanupImage(
    imageTag: string,
    warnings: string[],
  ): Promise<void> {
    try {
      const result = await runCommand('docker', ['image', 'rm', imageTag], {
        timeoutMs: 30000,
      });
      if (result.timedOut || result.exitCode !== 0) {
        warnings.push(
          `No se pudo limpiar la imagen ${imageTag}: ${result.stderr.trim() || 'sin detalle.'}`,
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'error desconocido.';
      warnings.push(`No se pudo limpiar la imagen ${imageTag}: ${message}`);
    }
  }

  private createImageTag(deliveryId: string): string {
    const normalizedDeliveryId = deliveryId
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    return `dockus-delivery-${normalizedDeliveryId}-${Date.now()}`;
  }

  private collectRootFiles(runtimeFiles: RuntimeFile[]): string {
    const roots = runtimeFiles
      .map((file) => file.relativePath)
      .filter((relativePath) => !relativePath.includes('/'))
      .sort((a, b) => a.localeCompare(b));
    return roots.join(', ');
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

  private async readTextFile(absolutePath: string): Promise<string> {
    const fileBuffer = await readFile(absolutePath);
    if (fileBuffer.includes(0)) {
      return '';
    }
    return fileBuffer.toString('utf8');
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

  private isDockerInfrastructureError(logText: string): boolean {
    const normalized = logText.toLowerCase();
    return (
      normalized.includes('cannot connect to the docker daemon') ||
      normalized.includes(
        'permission denied while trying to connect to the docker api',
      ) ||
      normalized.includes('is the docker daemon running')
    );
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await access(filePath);
      return true;
    } catch {
      return false;
    }
  }

}
