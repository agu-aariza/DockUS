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
