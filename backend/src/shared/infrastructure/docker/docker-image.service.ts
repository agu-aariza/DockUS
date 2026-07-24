/**
 * @fileoverview Construcción e inspección de imágenes Docker vía CLI.
 *
 * Contexto:
 * - El pipeline materializa las dependencias de una entrega en una imagen
 *   inmutable en lugar de instalarlas dentro del contenedor que ejecuta el
 *   código del alumno. Una imagen no puede ser modificada por el proceso que
 *   la usa, de modo que dos entregas con las mismas dependencias comparten
 *   entorno sin poder contaminarse entre sí.
 *
 * @module DockerImageService
 */

import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { runCommand } from './command-runner.util';
import type {
  DockerImageBuildOptions,
  DockerImageInspectOptions,
} from './docker.types';
import {
  buildDockerLabelArgs,
  isMissingDockerResource,
  normalizeDockerCommandError,
} from './docker.utils';

@Injectable()
export class DockerImageService {
  async imageExists(
    imageTag: string,
    options: DockerImageInspectOptions,
  ): Promise<boolean> {
    const result = await runCommand('docker', ['image', 'inspect', imageTag], {
      timeoutMs: options.timeoutMs,
      maxBufferedChars: options.maxBufferedChars ?? 250000,
    });

    if (isMissingDockerResource(result, /No such image|not found/iu)) {
      return false;
    }
    if (result.timedOut || result.exitCode !== 0) {
      throw new ServiceUnavailableException(
        `No se pudo inspeccionar la imagen ${imageTag}: ${normalizeDockerCommandError(result)}`,
      );
    }

    return true;
  }

  /**
   * Elimina las imágenes de entorno más antiguas que `olderThanHours`.
   *
   * Se apoya en la etiqueta `dockus.role=environment` que ya aplica
   * `BuilderEnvironmentImageService` al construirlas, de modo que la poda no
   * puede alcanzar imágenes ajenas al sistema. Docker no borra una imagen en
   * uso por un contenedor vivo, así que una evaluación en curso no se ve
   * afectada.
   *
   * `--all` es imprescindible y no una optimización. Sin él, `docker image
   * prune` **solo considera imágenes colgantes** (las que han perdido su
   * etiqueta), y las imágenes de entorno siempre están etiquetadas como
   * `dockus-env-<hash>:latest`. Verificado en la fase 4 (T4.6): el comando sin
   * `--all` recuperaba 0 B dejando intacta una imagen de entorno de nueve días
   * y 1,39 GB que cumplía ambos filtros. El filtro por etiqueta sigue acotando
   * el alcance, de modo que `--all` no amplía lo que la poda puede tocar: solo
   * hace que llegue a tocarlo.
   *
   * @returns número de imágenes eliminadas.
   */
  async pruneEnvironmentImages(options: {
    olderThanHours: number;
    timeoutMs: number;
  }): Promise<number> {
    const result = await runCommand(
      'docker',
      [
        'image',
        'prune',
        '--all',
        '--force',
        '--filter',
        'label=dockus.role=environment',
        '--filter',
        `until=${Math.max(1, Math.floor(options.olderThanHours))}h`,
      ],
      { timeoutMs: options.timeoutMs },
    );

    if (result.timedOut || result.exitCode !== 0) {
      throw new ServiceUnavailableException(
        `No se pudo podar las imagenes de entorno: ${normalizeDockerCommandError(result)}`,
      );
    }

    // La salida lista una línea por imagen bajo la cabecera "Deleted Images:".
    return result.stdout
      .split('\n')
      .filter((line) => line.trim().startsWith('deleted:')).length;
  }

  async buildImage(options: DockerImageBuildOptions): Promise<void> {
    const args = [
      'image',
      'build',
      '--tag',
      options.imageTag,
      ...(options.dockerfilePath ? ['--file', options.dockerfilePath] : []),
      ...buildDockerLabelArgs(options.labels),
      options.contextDir,
    ];

    const result = await runCommand('docker', args, {
      timeoutMs: options.timeoutMs,
      maxBufferedChars: options.maxBufferedChars ?? 1_000_000,
    });

    if (result.timedOut || result.exitCode !== 0) {
      throw new ServiceUnavailableException(
        `No se pudo construir la imagen ${options.imageTag}: ${normalizeDockerCommandError(result)}`,
      );
    }
  }
}
