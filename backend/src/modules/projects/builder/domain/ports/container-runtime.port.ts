/**
 * @fileoverview Puerto del sandbox de contenedores para el Builder (container-runtime.port).
 *
 * @module container-runtime.port
 */

import type { DockerRunOptions } from '../../../../../shared/infrastructure/docker/docker.types';

/**
 * Contrato mínimo que necesita el Builder para ejecutar código efímero y
 * gestionar las imágenes de los sandboxes. La implementación de Docker queda
 * detrás de este puerto; los consumidores no dependen del ciclo de vida del
 * cliente ni de operaciones de infraestructura que no usan.
 */
export interface IContainerRuntime {
  /** Ejecuta un comando en un contenedor efímero y devuelve su resultado completo. */
  runEphemeralContainer(
    options: DockerRunOptions,
  ): Promise<{ exitCode: number; stdout: string; stderr: string }>;

  /** Comprueba si una imagen ya existe localmente. */
  imageExists(imageTag: string): Promise<boolean>;

  /** Construye una imagen a partir de un contexto de build. */
  buildImage(options: {
    imageTag: string;
    contextDir: string;
    labels?: Record<string, string>;
  }): Promise<void>;

  /** Poda imágenes de entorno huérfanas más antiguas que `olderThanHours`. */
  pruneEnvironmentImages(options: {
    olderThanHours: number;
    timeoutMs: number;
  }): Promise<number>;
}

export const CONTAINER_RUNTIME = Symbol('IContainerRuntime');
