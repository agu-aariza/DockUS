/**
 * @fileoverview Motor Builder de evaluación asíncrona (execution-stage.handler).
 *
 * @module execution-stage.handler
 */

import { Injectable } from '@nestjs/common';
import { IBuilderStageHandler } from './builder-stage.interface';
import { DockerExecutionService } from '../../../../../../shared/infrastructure/docker/docker-execution.service';
import { BuilderRunSupportService } from '../orchestration/builder-run-support.service';
import { BuilderEnvironmentImageService } from '../workspace/builder-environment-image.service';
import { BuildRunStatus } from '../../../domain/entities/build-run.entity';
import { StageWorkspaceResult } from '../workspace/builder-workspace.service';
import { CompiledRecipe } from '../compilation/builder-recipe-compiler.service';
import { BuilderConfigProvider } from '../../../domain/builder-config.provider';
import {
  BuilderExecutionResult,
  BuilderStudentStage,
} from '../../../domain/builder.types';
import { randomUUID } from 'crypto';
import { chown, readdir } from 'fs/promises';
import * as path from 'path';
import { BuilderExecutionLogBatcher } from './builder-execution-log-batcher';

interface ExecutionStageInput {
  runId: string;
  workspace: StageWorkspaceResult;
  compiled: CompiledRecipe;
  /** Cancelacion cooperativa (ARQ-004): mata el contenedor en curso. */
  signal?: AbortSignal;
}

interface ExecutionStageOutput {
  execution: BuilderExecutionResult;
}

/** Ruta dentro del contenedor donde se monta la suite docente, en solo lectura. */
const TEACHER_TESTS_MOUNT_PATH = '/app/.dockus/teacher-tests';

/** Usuario sin privilegios estándar (`nobody`). */
const NOBODY_UID = 65534;
const NOBODY_GID = 65534;

@Injectable()
export class BuilderExecutionStageHandler implements IBuilderStageHandler<
  ExecutionStageInput,
  ExecutionStageOutput
> {
  constructor(
    private readonly dockerExecutionService: DockerExecutionService,
    private readonly builderRunSupportService: BuilderRunSupportService,
    private readonly builderEnvironmentImageService: BuilderEnvironmentImageService,
    private readonly builderConfigProvider: BuilderConfigProvider,
  ) {}

  async handle(input: ExecutionStageInput): Promise<ExecutionStageOutput> {
    const { runId, workspace, compiled, signal } = input;

    const environmentImage =
      await this.builderEnvironmentImageService.ensureEnvironmentImage({
        projectRootDir: workspace.projectRootDir,
        baseImage: compiled.image,
        aptCmd: compiled.aptCmd,
        dependencyInstallCmd: compiled.dependencyInstallCmd,
      });

    if (environmentImage.built) {
      await this.builderRunSupportService.emitEvent({
        buildRunId: runId,
        eventType: 'RUN_STATUS_CHANGED',
        runStatus: BuildRunStatus.RUNNING,
        message: 'Dependencias instaladas en una imagen de entorno aislada.',
      });
    } else if (environmentImage.imageTag !== compiled.image) {
      await this.builderRunSupportService.emitEvent({
        buildRunId: runId,
        eventType: 'LOG_CHUNK',
        runStatus: BuildRunStatus.RUNNING,
        message: `Reutilizando imagen de entorno ${environmentImage.imageTag}.`,
      });
    }

    await this.builderRunSupportService.emitEvent({
      buildRunId: runId,
      eventType: 'RUN_STATUS_CHANGED',
      runStatus: BuildRunStatus.RUNNING,
      message: `Iniciando ejecucion del servicio (Puerto: ${compiled.servicePort || 'N/A'})...`,
      payload: { studentStage: 'executing' satisfies BuilderStudentStage },
    });

    // La suite docente se monta en un bind independiente y en solo lectura: el
    // kernel impone el `:ro`, mientras que los bits de permiso del fichero son
    // evitables desde dentro del contenedor. Sin esto, el alumno podría
    // reescribir los tests con los que se le califica.
    const binds = [`${workspace.projectRootDir}:/app`];
    if (workspace.hasTeacherTests) {
      binds.push(
        `${workspace.teacherTestsRootDir}:${TEACHER_TESTS_MOUNT_PATH}:ro`,
      );
    }

    const containerUser = await this.prepareUnprivilegedUser(
      workspace.projectRootDir,
    );

    // La emisión de LOG_CHUNK se agrupa: un evento persistido por fragmento de
    // stdout es el primer cuello de botella del sistema. La detección de
    // evidencia sí es por fragmento, pero es en memoria y no toca la base de datos.
    const logBatcher = new BuilderExecutionLogBatcher((stream, text) =>
      this.builderRunSupportService.emitEvent({
        buildRunId: runId,
        eventType: 'LOG_CHUNK',
        runStatus: BuildRunStatus.RUNNING,
        message: `Output de ejecucion (${stream})`,
        payload: { text },
      }),
    );

    let capturingEvidence = false;
    let evidenceBuffer = '';

    const execResult = await this.dockerExecutionService.runEphemeralContainer({
      containerName: `dockus-run-${runId}-${randomUUID().slice(0, 8)}`,
      imageTag: environmentImage.imageTag,
      command: compiled.finalCommand,
      binds,
      workingDir: compiled.workingDirectory ?? '/app',
      environment: {
        // El proceso corre sin privilegios y con la raíz en solo lectura: HOME
        // debe apuntar al único punto escribible fuera del workspace.
        HOME: '/tmp',
        ...environmentImage.environment,
        ...(compiled.environment ?? {}),
      },
      networkMode: 'none',
      readOnlyRootfs: true,
      pidsLimit: this.builderConfigProvider.executionPidsLimit,
      user: containerUser,
      memory: this.builderConfigProvider.executionMemoryLimit,
      cpus: this.builderConfigProvider.executionCpuLimit,
      signal,
      onStdoutChunk: (chunk) => {
        if (chunk.includes('--- HEALTHCHECK EVIDENCE ---')) {
          capturingEvidence = true;
        }
        if (capturingEvidence) {
          evidenceBuffer += chunk;
          if (chunk.includes('--- END EVIDENCE ---')) {
            capturingEvidence = false;
            const cleanEvidence = evidenceBuffer
              .replace('--- HEALTHCHECK EVIDENCE ---', '')
              .replace('--- END EVIDENCE ---', '')
              .trim();

            void this.builderRunSupportService.emitEvent({
              buildRunId: runId,
              eventType: 'RUN_STATUS_CHANGED',
              runStatus: BuildRunStatus.RUNNING,
              message: cleanEvidence
                ? 'Prueba de vida: el servicio respondio correctamente.'
                : 'Prueba de vida: servicio alcanzable.',
              payload: {
                evidence: cleanEvidence.slice(0, 300),
                studentStage: 'executing' satisfies BuilderStudentStage,
              },
            });
          }
        }

        logBatcher.push('stdout', chunk);
      },
      onStderrChunk: (chunk) => {
        logBatcher.push('stderr', chunk);
      },
    });

    // Descarga el texto pendiente antes de que el pipeline continúe, de modo que
    // ningún fragmento quede sin persistir cuando la ejecución termina.
    await logBatcher.flush();

    // Un fallo del programa del alumno (exit code != 0, timeout) es un
    // resultado legítimo y viaja en `execResult`. Un fallo de infraestructura
    // (daemon caído, imagen inexistente) se propaga como excepción: el
    // orquestador marcará el run como FAILED. Degradarlo a un resultado
    // "ran: true" haría que el LLM lo interpretase como la salida del
    // programa y calificase código que nunca llegó a ejecutarse.
    return {
      execution: {
        ran: true,
        stdout: execResult.stdout,
        stderr: execResult.stderr,
        exitCode: execResult.exitCode,
      },
    };
  }

  /**
   * Determina el `uid:gid` sin privilegios con el que correrá el contenedor y
   * garantiza que el workspace le sea escribible: la compilación de C genera
   * binarios dentro de `/app`, de modo que el bind debe seguir siendo
   * escribible aunque el proceso ya no sea root.
   *
   * Si el worker corre como root (el caso en la imagen de desarrollo), el
   * workspace se transfiere a `nobody`; si ya corre sin privilegios, se reutiliza
   * su propio uid, que es quien creó los ficheros.
   */
  private async prepareUnprivilegedUser(
    projectRootDir: string,
  ): Promise<string | undefined> {
    if (typeof process.getuid !== 'function') {
      return undefined;
    }

    const uid = process.getuid();
    const gid = typeof process.getgid === 'function' ? process.getgid() : uid;
    if (uid !== 0) {
      return `${uid}:${gid}`;
    }

    await this.chownRecursive(projectRootDir, NOBODY_UID, NOBODY_GID);
    return `${NOBODY_UID}:${NOBODY_GID}`;
  }

  private async chownRecursive(
    rootDir: string,
    uid: number,
    gid: number,
  ): Promise<void> {
    await chown(rootDir, uid, gid);
    const entries = await readdir(rootDir, {
      recursive: true,
      withFileTypes: true,
    });
    await Promise.all(
      entries.map((entry) =>
        chown(path.join(entry.parentPath, entry.name), uid, gid).catch(
          () => undefined,
        ),
      ),
    );
  }
}
