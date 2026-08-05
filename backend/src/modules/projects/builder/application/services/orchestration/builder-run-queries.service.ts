/**
 * @fileoverview Consultas de lectura para runs del builder.
 *
 * Contexto:
 * - Centraliza paginación, acceso a evidencias y lectura de runs.
 * - Mantiene separada la lectura de las operaciones que mutan el pipeline.
 *
 * @module BuilderRunQueriesService
 */

import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { buildPaginationMeta } from '../../../../../../shared/utils/pagination.util';
import type { AuthenticatedUser } from '../../../../../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../../../../../users/entities/user.entity';
import { BuildRun } from '../../../domain/entities/build-run.entity';
import type { IBuildRunRepository } from '../../../domain/repositories/build-run.repository.interface';
import { BUILD_RUN_REPOSITORY } from '../../../domain/repositories/build-run.repository.interface';
import { BuilderRunEventsService } from '../../../infrastructure/events/builder-run-events.service';
import {
  BuilderRunEvent,
  EvidenceArtifactPublic,
} from '../../../domain/builder.types';
import { isStaffOnlyBuildRunArtifactType } from '../../../domain/entities/build-run-artifact.entity';
import { EvidenceService } from '../../../infrastructure/evidence/evidence.service';
import { ListBuildRunsDto } from '../../../presentation/dto/list-build-runs.dto';
import { BuilderAccessService } from '../workspace/builder-access.service';
import type { PaginatedBuildRunsResponse } from '../builder-application.types';
import { BuilderQualityAggregationService } from '../evaluation/builder-quality-aggregation.service';

/**
 * Tope de páginas al drenar el backlog inicial del stream de eventos (200
 * eventos por página). Cubre runs con historial extenso sin permitir que el
 * bucle gire para siempre sobre un run que aún está produciendo eventos.
 *
 * Reducido de 50 a 10. Con 50, **cada** conexión podía disparar
 * hasta 50 consultas secuenciales a Postgres antes de llegar al `subscribe`,
 * de modo que una reconexión masiva —un redespliegue, la caída del balanceador—
 * multiplicaba ese coste por el número de clientes y se convertía en una
 * denegación de servicio provocada por el propio sistema.
 *
 * El recorte no pierde eventos: el cliente envía `afterSequence` y reanuda
 * exactamente donde lo dejó, así que el drenaje largo solo ocurría en conexiones
 * genuinamente frías. Para ese caso, 10 páginas son 2.000 eventos; quien
 * necesite más historial que eso lo tiene en el endpoint REST paginado, que es
 * el sitio adecuado para recorrerlo, y no reteniendo abierta una conexión SSE.
 */
const MAX_BACKLOG_DRAIN_PAGES = 10;

/**
 * Receptor de los eventos de un stream de run. El controlador SSE es la única
 * implementación real: `onReady` escribe el frame `event: ready`, `onEvent`
 * escribe `event: run-event`. Mantener el formato de transporte fuera de este
 * servicio es justo lo que permite reutilizar la paginación/drenaje/suscripción
 * desde cualquier otro transporte el día que haga falta.
 */
export interface BuilderRunEventSink {
  onReady(latestSequence: number): void;
  onEvent(event: BuilderRunEvent): void;
}

@Injectable()
export class BuilderRunQueriesService {
  constructor(
    @Inject(BUILD_RUN_REPOSITORY)
    private readonly buildRunsRepository: IBuildRunRepository,
    private readonly builderAccessService: BuilderAccessService,
    private readonly builderRunEventsService: BuilderRunEventsService,
    private readonly evidenceService: EvidenceService,
    private readonly builderQualityAggregationService: BuilderQualityAggregationService,
  ) {}

  async getRunById(
    buildRunId: string,
    actor: AuthenticatedUser,
  ): Promise<BuildRun> {
    const run = await this.buildRunsRepository.findById(buildRunId);
    if (!run) {
      throw new NotFoundException('BuildRun no encontrado.');
    }
    await this.builderAccessService.assertCanAccessBuildRun(run, actor);
    return run;
  }

  async listRunsByDelivery(
    deliveryId: string,
    query: ListBuildRunsDto,
    actor: AuthenticatedUser,
  ): Promise<PaginatedBuildRunsResponse> {
    const delivery =
      await this.builderAccessService.findDeliveryOrThrow(deliveryId);
    await this.builderAccessService.assertCanAccessDelivery(delivery, actor);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const sortOrder = query.sortOrder;

    const { data, total } =
      await this.buildRunsRepository.findPaginatedByDelivery(deliveryId, {
        status: query.status,
        page,
        limit,
        sortOrder,
      });

    return {
      data,
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  /**
   * Ultimo BuildRun por entrega, en una unica consulta (DISTINCT ON), para
   * las entregas indicadas. Resuelve todas las entregas en una única llamada
   * batch en vez de una petición GET por entrega.
   *
   * El scoping de acceso se resuelve en la propia consulta SQL, no por
   * entrega vía `assertCanAccessDelivery` en un bucle (eso solo trasladaria
   * el N+1 al backend): STUDENT solo ve sus propias entregas, TEACHER solo
   * las de proyectos a los que esta asignado, ADMIN todas. Las entregas
   * fuera de alcance del actor simplemente no aparecen en el resultado (se
   * devuelven como `null`), sin filtrar cuales de los IDs solicitados eran
   * ajenos.
   */
  async listLatestRunsByDeliveryIds(
    deliveryIds: string[],
    actor: AuthenticatedUser,
  ): Promise<Record<string, BuildRun | null>> {
    const uniqueIds = Array.from(new Set(deliveryIds));
    const result: Record<string, BuildRun | null> = {};
    for (const id of uniqueIds) {
      result[id] = null;
    }
    if (uniqueIds.length === 0) {
      return result;
    }

    const runs = await this.buildRunsRepository.findLatestByDeliveryIdsForActor(
      uniqueIds,
      actor,
    );
    for (const run of runs) {
      result[run.deliveryId] = run;
    }
    return result;
  }

  async listRunEvents(
    buildRunId: string,
    actor: AuthenticatedUser,
    afterSequence = 0,
    limit = 100,
  ) {
    await this.getRunById(buildRunId, actor);
    return this.builderRunEventsService.list(buildRunId, afterSequence, limit);
  }

  async subscribeRunEvents(
    buildRunId: string,
    actor: AuthenticatedUser,
    listener: (event: BuilderRunEvent) => void,
  ): Promise<() => void> {
    await this.getRunById(buildRunId, actor);
    return this.builderRunEventsService.subscribe(buildRunId, listener);
  }

  /**
   * Drena el backlog de un run (con el tope de `MAX_BACKLOG_DRAIN_PAGES`) y
   * deja el stream suscrito a los eventos que lleguen después, entregando todo
   * al `sink` provisto. El control de acceso se resuelve una única vez al
   * principio — igual que ya hacía `subscribeRunEvents` para toda la porción
   * en vivo, que es la que domina la vida de la conexión — en vez de
   * repetirse en cada página del drenaje.
   */
  async streamRunEvents(
    buildRunId: string,
    actor: AuthenticatedUser,
    afterSequence: number,
    sink: BuilderRunEventSink,
  ): Promise<{ unsubscribe: () => void }> {
    await this.getRunById(buildRunId, actor);

    const firstPage = await this.builderRunEventsService.list(
      buildRunId,
      afterSequence,
      200,
    );
    let latestSequence = Math.max(afterSequence, firstPage.latestSequence);
    sink.onReady(latestSequence);
    for (const event of firstPage.events) {
      sink.onEvent(event);
    }

    let hasMore = firstPage.hasMore;
    let drainedPages = 0;
    while (hasMore && drainedPages < MAX_BACKLOG_DRAIN_PAGES) {
      const page = await this.builderRunEventsService.list(
        buildRunId,
        latestSequence,
        200,
      );
      latestSequence = Math.max(latestSequence, page.latestSequence);
      hasMore = page.hasMore;
      drainedPages += 1;
      for (const event of page.events) {
        sink.onEvent(event);
      }
    }

    const unsubscribe = this.builderRunEventsService.subscribe(
      buildRunId,
      (event) => {
        latestSequence = Math.max(latestSequence, event.sequence);
        sink.onEvent(event);
      },
    );

    return { unsubscribe };
  }

  async listEvidenceArtifacts(
    buildRunId: string,
    actor: AuthenticatedUser,
  ): Promise<EvidenceArtifactPublic[]> {
    await this.getRunById(buildRunId, actor);
    const artifacts = await this.evidenceService.listArtifacts(buildRunId);
    return this.filterArtifactsForActor(artifacts, actor);
  }

  async getEvidenceArtifactContent(
    buildRunId: string,
    artifactId: string,
    actor: AuthenticatedUser,
  ): Promise<{ content: Buffer; contentType: string }> {
    await this.getRunById(buildRunId, actor);
    const visibleArtifacts = this.filterArtifactsForActor(
      await this.evidenceService.listArtifacts(buildRunId),
      actor,
    );
    if (!visibleArtifacts.some((artifact) => artifact.id === artifactId)) {
      throw new NotFoundException('Artefacto de evidencia no encontrado.');
    }
    return this.evidenceService.getArtifactContent(buildRunId, artifactId);
  }

  async createEvidenceDownloadUrl(
    buildRunId: string,
    artifactId: string,
    actor: AuthenticatedUser,
  ): Promise<{ downloadUrl: string; expiresAt: string }> {
    await this.getRunById(buildRunId, actor);
    const visibleArtifacts = this.filterArtifactsForActor(
      await this.evidenceService.listArtifacts(buildRunId),
      actor,
    );
    if (!visibleArtifacts.some((artifact) => artifact.id === artifactId)) {
      throw new NotFoundException('Artefacto de evidencia no encontrado.');
    }
    return this.evidenceService.createArtifactDownloadUrl(
      buildRunId,
      artifactId,
    );
  }

  /**
   * delega en `BuilderQualityAggregationService`, que agrega con SQL
   * sobre `code_quality_findings` (la proyeccion consultable) en vez de cargar
   * en memoria todos los runs con findings y recorrer su jsonb con `as any`
   * sin cota. El jsonb (`run.codeQualityFindings`) sigue siendo la fuente
   * canonica del documento del run; esto es solo la vista agregada.
   */
  async getAssignmentQualityInsights(
    assignmentId: string,
    actor: AuthenticatedUser,
  ) {
    this.builderAccessService.assertIsStaff(actor);

    return this.builderQualityAggregationService.getInsightsForAssignment(
      assignmentId,
    );
  }

  private filterArtifactsForActor(
    artifacts: EvidenceArtifactPublic[],
    actor: AuthenticatedUser,
  ): EvidenceArtifactPublic[] {
    if (actor.role === UserRole.ADMIN || actor.role === UserRole.TEACHER) {
      return artifacts;
    }

    return artifacts.filter(
      (artifact) => !isStaffOnlyBuildRunArtifactType(artifact.type),
    );
  }
}
