/**
 * @fileoverview Puerto de persistencia de `BuildRunEventEntity`
 * (build-run-event.repository.interface).
 *
 * @module build-run-event.repository.interface
 */

import { BuildRunEventEntity } from '../../builder/domain/entities/build-run-event.entity';
import type { BuildRunEventType } from '../../builder/domain/builder.types';

/**
 * Puerto real (audit/areas/arquitectura/plan_accion.md P2-7): sin puerto
 * previo, único consumidor real (`BuilderRunEventsService`). Este servicio
 * vive en `infrastructure/events/` pero se migra igualmente, mismo criterio
 * que `BuildRun` en P2-4: `BuildRunEventEntity` es un agregado de dominio (el
 * log de eventos del run), no una librería externa envuelta.
 */
export const BUILD_RUN_EVENT_REPOSITORY = Symbol('IBuildRunEventRepository');

/** Campos aceptados por `Repository.create()` — construcción en memoria, sin persistir. */
export interface NewBuildRunEventData {
  buildRunId: string;
  eventType: BuildRunEventType;
  runStatus: string | null;
  message: string;
  payload: Record<string, unknown> | null;
}

export interface IBuildRunEventRepository {
  create(data: NewBuildRunEventData): BuildRunEventEntity;
  save(event: BuildRunEventEntity): Promise<BuildRunEventEntity>;

  /**
   * Página de eventos de un run posteriores a `afterSequence`, ordenados por
   * secuencia ascendente. Devuelve `limit + 1` filas a propósito (el
   * consumidor recorta a `limit` y usa la fila extra para saber si hay más).
   */
  findPage(
    buildRunId: string,
    afterSequence: number,
    limit: number,
  ): Promise<BuildRunEventEntity[]>;
}
