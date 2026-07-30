/**
 * @fileoverview Puerto del sandbox de contenedores para el Builder (container-runtime.port).
 *
 * @module container-runtime.port
 */

import type { DockerRunOptions } from '../../../../../shared/infrastructure/docker/docker.types';

/**
 * Plan de arquitectura hexagonal, Fase 1 (P1-1, ver
 * ARQ-007). Cubre exactamente los 4 métodos
 * que los consumidores reales usan hoy de `DockerExecutionService`/
 * `DockerImageService` — auditado con grep antes de diseñar, no adivinado
 * (el resto de la superficie de esas dos clases, p. ej. redes o contenedores
 * daemon, no tiene ningún llamador fuera de la propia infraestructura Docker).
 *
 * Reutiliza `DockerRunOptions` de `shared/infrastructure/docker/docker.types.ts`
 * en vez de definir un tipo propio del puerto: es un fichero puro de tipos/
 * constantes sin imports ni clases (mismo perfil que `llm.types.ts`, con la
 * misma excepción en `.dependency-cruiser.cjs`), y redefinir sus ~15 campos
 * aquí sería una copia casi idéntica sin beneficio mientras Docker sea la
 * única implementación real. Si aparece una segunda implementación genuina,
 * es el momento de extraer un tipo de entrada propio del puerto.
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
