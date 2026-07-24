/**
 * @fileoverview Cuota de gasto en inferencia por proyecto.
 *
 * Contexto (ESC-ALTO-02):
 * - `BuildRun.executionCostUsd` se venía midiendo con precisión —etapa a etapa,
 *   con la tarifa de cada proveedor— pero **nunca se capaba**. Un bucle de
 *   reevaluación, un proyecto mal configurado o simplemente un curso numeroso
 *   podían facturar sin límite, y el sistema no tenía forma de enterarse hasta
 *   ver la factura del proveedor.
 *
 * Dónde se comprueba y por qué:
 * - **Antes de encolar**, no durante el pipeline. Una vez lanzado el run, sus
 *   tres o cuatro llamadas ya están comprometidas; abortar a mitad gasta el
 *   dinero igual y además deja al alumno sin evaluación. Rechazar en el
 *   encolado es el único punto donde negarse ahorra dinero de verdad.
 * - La consecuencia asumida es que la cuota puede **rebasarse dentro de un
 *   run**: se comprueba con el gasto acumulado hasta ese momento y el run en
 *   curso añade el suyo. El desbordamiento está acotado al coste de un run.
 *
 * @module BuilderSpendQuotaService
 */

import { ForbiddenException, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { IBuildRunRepository } from '../../../../domain/repositories/build-run.repository.interface';

/** `0` desactiva el tope, que es el comportamiento histórico. */
const DEFAULT_PROJECT_QUOTA_USD = 0;

@Injectable()
export class BuilderSpendQuotaService {
  private readonly logger = new Logger(BuilderSpendQuotaService.name);
  private readonly projectQuotaUsd: number;

  constructor(
    @Inject('IBuildRunRepository')
    private readonly buildRunsRepository: IBuildRunRepository,
    configService: ConfigService,
  ) {
    this.projectQuotaUsd = configService.get<number>(
      'BUILDER_PROJECT_SPEND_QUOTA_USD',
      DEFAULT_PROJECT_QUOTA_USD,
    );
  }

  get isEnabled(): boolean {
    return this.projectQuotaUsd > 0;
  }

  /**
   * Gasto acumulado en inferencia de todas las ejecuciones del proyecto.
   *
   * Suma en la base de datos y no en memoria: traerse los runs de un curso
   * entero para sumar una columna repetiría el defecto que costó corregir en
   * ESC-CRIT-05.
   */
  async getProjectSpendUsd(projectId: string): Promise<number> {
    return this.buildRunsRepository.sumExecutionCostUsdByProject(projectId);
  }

  /**
   * Rechaza el encolado si el proyecto ya agotó su cuota.
   *
   * El mensaje nombra la cifra y el tope a propósito: un rechazo por cuota que
   * no diga cuánto se lleva gastado es indistinguible de una avería para quien
   * lo recibe, y manda a un docente a abrir una incidencia en vez de a revisar
   * su configuración.
   */
  async assertProjectWithinQuota(projectId: string): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    const spent = await this.getProjectSpendUsd(projectId);
    if (spent < this.projectQuotaUsd) {
      return;
    }

    this.logger.warn(
      JSON.stringify({
        event: 'builder_project_quota_exhausted',
        projectId,
        spentUsd: spent,
        quotaUsd: this.projectQuotaUsd,
      }),
    );

    throw new ForbiddenException(
      `El proyecto ha alcanzado su cuota de gasto en evaluacion ` +
        `(${spent.toFixed(2)} USD de ${this.projectQuotaUsd.toFixed(2)} USD). ` +
        `Solicite una ampliacion al administrador para seguir evaluando.`,
    );
  }
}
