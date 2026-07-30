/**
 * @fileoverview Servicio de comprobación y control de cuotas de gasto en inferencia por proyecto.
 *
 * @description
 * Evalúa el coste acumulado en USD de las evaluaciones de un proyecto frente al límite configurado.
 * Se ejecuta preventivamente en el encolamiento de nuevas entregas para denegar el consumo si se agota la cuota.
 *
 * @module BuilderSpendQuotaService
 */

import { ForbiddenException, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { IBuildRunRepository } from '../../../domain/repositories/build-run.repository.interface';
import { BUILD_RUN_REPOSITORY } from '../../../domain/repositories/build-run.repository.interface';

/** `0` desactiva el tope, que es el comportamiento histórico. */
const DEFAULT_PROJECT_QUOTA_USD = 0;

@Injectable()
export class BuilderSpendQuotaService {
  private readonly logger = new Logger(BuilderSpendQuotaService.name);
  private readonly projectQuotaUsd: number;

  constructor(
    @Inject(BUILD_RUN_REPOSITORY)
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
