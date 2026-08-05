/**
 * @fileoverview Comprobación de capacidad del worker frente a la RAM del host.
 *
 * Contexto:
 * - Cada unidad de concurrencia del worker levanta un contenedor con su propio
 * límite de memoria. El producto `concurrencia × límite` no lo acota nada, de
 * modo que una configuración desmedida no agota la cola sino la RAM del
 * anfitrión, y el OOM se lleva al worker entero —con todas sus evaluaciones
 * en curso— en lugar de a un contenedor.
 * - La parte del hallazgo que sí desapareció es la de los workspaces: desde
 * viven en un volumen de disco (`TMPDIR=/educodeai-workspaces`) y ya
 * no en el tmpfs respaldado por RAM.
 *
 * Esto solo **avisa**. Negarse a arrancar por una heurística de memoria sería
 * peor que el problema: el anfitrión puede tener otras reservas, o el operador
 * puede saber algo que esta cuenta no.
 *
 * @module WorkerCapacityUtil
 */

/** Fracción de la RAM total por encima de la cual se considera temerario. */
const SAFE_FRACTION = 0.7;

/** Convierte un límite de memoria de Docker (`512m`, `2g`, `1024k`) a bytes. */
export function parseDockerMemoryLimit(raw: string): number | null {
  const match = /^(\d+(?:\.\d+)?)\s*([bkmg]?)$/i.exec(raw.trim());
  if (!match) {
    return null;
  }

  const value = Number(match[1]);
  const factor =
    { '': 1, b: 1, k: 1024, m: 1024 ** 2, g: 1024 ** 3 }[
      match[2].toLowerCase()
    ] ?? 1;

  return value * factor;
}

export interface CapacityAssessment {
  concurrency: number;
  perContainerBytes: number;
  worstCaseBytes: number;
  totalRamBytes: number;
  /** `true` si el peor caso supera la fracción segura de la RAM del host. */
  exceedsSafeFraction: boolean;
}

export function assessWorkerCapacity(input: {
  concurrency: number;
  memoryLimit: string;
  totalRamBytes: number;
}): CapacityAssessment | null {
  const perContainerBytes = parseDockerMemoryLimit(input.memoryLimit);
  if (perContainerBytes === null || input.totalRamBytes <= 0) {
    // Sin un límite interpretable no hay nada que comparar; callar es mejor
    // que avisar sobre una cuenta que no se ha podido hacer.
    return null;
  }

  const worstCaseBytes = perContainerBytes * input.concurrency;

  return {
    concurrency: input.concurrency,
    perContainerBytes,
    worstCaseBytes,
    totalRamBytes: input.totalRamBytes,
    exceedsSafeFraction: worstCaseBytes > input.totalRamBytes * SAFE_FRACTION,
  };
}
