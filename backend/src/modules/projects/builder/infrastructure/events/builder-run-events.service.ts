/**
 * @fileoverview Motor Builder de evaluación asíncrona (builder-run-events.service).
 *
 * @module builder-run-events.service
 */

import { EventEmitter } from 'events';
import {
  Inject,
  Injectable,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import type Redis from 'ioredis';
import { RedisClientService } from '../../../../../shared/infrastructure/cache/redis-client.service';
import {
  BuilderRunEvent,
  BuilderRunEventsPage,
  BuildRunEventType,
} from '../../domain/builder.types';
import { BuildRunEventEntity } from '../../domain/entities/build-run-event.entity';
import type { IBuildRunRepository } from '../../../domain/repositories/build-run.repository.interface';
import { BUILD_RUN_REPOSITORY } from '../../../domain/repositories/build-run.repository.interface';
import type { IBuildRunEventRepository } from '../../../domain/repositories/build-run-event.repository.interface';
import { BUILD_RUN_EVENT_REPOSITORY } from '../../../domain/repositories/build-run-event.repository.interface';
import { PROCESS_ROLE } from '../../../../../process-role.module';
import type { ProcessRole } from '../../../../../process-role.module';

interface EmitBuilderRunEventInput {
  buildRunId: string;
  eventType: BuildRunEventType;
  runStatus?: string | null;
  message: string;
  payload?: Record<string, unknown> | null;
}

const DEFAULT_EVENT_PAGE_LIMIT = 100;
const MAX_EVENT_PAGE_LIMIT = 500;
const BUILDER_EVENTS_PATTERN = 'builder:runs:events:*';

@Injectable()
export class BuilderRunEventsService
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly emitter = new EventEmitter();
  private subscriber: Redis | null = null;
  private subscriberReady = false;

  constructor(
    @Inject(BUILD_RUN_EVENT_REPOSITORY)
    private readonly eventsRepository: IBuildRunEventRepository,
    @Inject(BUILD_RUN_REPOSITORY)
    private readonly buildRunsRepository: IBuildRunRepository,
    private readonly redisClientService: RedisClientService,
    @Inject(PROCESS_ROLE)
    private readonly processRole: ProcessRole,
  ) {}

  async onModuleInit(): Promise<void> {
    // La suscripcion Redis solo alimenta el fan-out SSE (`subscribe()`, usado
    // por el controller de streaming); el worker publica eventos via `emit()`
    // sin necesitarla. Antes se abria en ambos procesos sin ningun cliente
    // que la usara del lado del worker (ARQ-006).
    if (this.processRole !== 'api') {
      return;
    }
    await this.ensureSubscriber();
  }

  async onApplicationShutdown(): Promise<void> {
    if (!this.subscriber) {
      return;
    }

    try {
      await this.subscriber.quit();
    } catch {
      this.subscriber.disconnect();
    }
  }

  async emit(input: EmitBuilderRunEventInput): Promise<BuilderRunEvent> {
    const saved = await this.eventsRepository.save(
      this.eventsRepository.create({
        buildRunId: input.buildRunId,
        eventType: input.eventType,
        runStatus: input.runStatus ?? null,
        message: input.message,
        payload: input.payload ?? null,
      }),
    );

    const event = this.toPublicEvent(saved);
    // Un solo UPDATE con GREATEST en vez de leer-modificar-escribir: dos eventos
    // concurrentes del mismo run se pisaban la secuencia, y además esto evita el
    // SELECT + save() por cada evento (tres viajes a Postgres por línea de log).
    await this.buildRunsRepository.bumpLatestEventSequence(
      input.buildRunId,
      saved.sequence,
    );

    const channel = this.channel(input.buildRunId);
    this.emitter.emit(channel, event);
    try {
      await this.redisClientService.publish(channel, JSON.stringify(event));
    } catch {
      // Local emitter keeps same-process streams functional even if Redis is down.
    }

    return event;
  }

  async list(
    buildRunId: string,
    afterSequence = 0,
    limit = DEFAULT_EVENT_PAGE_LIMIT,
  ): Promise<BuilderRunEventsPage> {
    const boundedLimit = Math.max(
      1,
      Math.min(limit || DEFAULT_EVENT_PAGE_LIMIT, MAX_EVENT_PAGE_LIMIT),
    );

    const rows = await this.eventsRepository.findPage(
      buildRunId,
      afterSequence,
      boundedLimit + 1,
    );
    const events = rows
      .slice(0, boundedLimit)
      .map((row) => this.toPublicEvent(row));
    return {
      events,
      latestSequence: events.at(-1)?.sequence ?? afterSequence,
      hasMore: rows.length > boundedLimit,
    };
  }

  subscribe(
    buildRunId: string,
    listener: (event: BuilderRunEvent) => void,
  ): () => void {
    void this.ensureSubscriber();
    const channel = this.channel(buildRunId);
    this.emitter.on(channel, listener);
    return () => {
      this.emitter.off(channel, listener);
    };
  }

  private async ensureSubscriber(): Promise<void> {
    if (this.subscriberReady) {
      return;
    }

    if (!this.subscriber) {
      this.subscriber = this.redisClientService.createSubscriber();
      this.subscriber.on('pmessage', (_pattern, channel, payload) => {
        try {
          const parsed = JSON.parse(payload) as BuilderRunEvent;
          this.emitter.emit(channel, parsed);
        } catch {
          // Ignore malformed messages from external publishers.
        }
      });
      // ioredis reconecta por su cuenta; basta con re-suscribirse en cada
      // 'ready'. Sin esto, un fallo puntual de Redis al arrancar dejaba la
      // suscripción muerta para siempre y el SSE nunca recibía los eventos que
      // emite el worker (el fallback a polling del frontend lo enmascaraba).
      this.subscriber.on('ready', () => {
        this.subscriber
          ?.psubscribe(BUILDER_EVENTS_PATTERN)
          .then(() => {
            this.subscriberReady = true;
          })
          .catch(() => {
            this.subscriberReady = false;
          });
      });
      this.subscriber.on('end', () => {
        this.subscriberReady = false;
      });
    }

    try {
      if (this.subscriber.status === 'wait') {
        await this.subscriber.connect();
      }
      await this.subscriber.psubscribe(BUILDER_EVENTS_PATTERN);
      this.subscriberReady = true;
    } catch {
      // No es fatal: el handler de 'ready' volverá a intentarlo en cuanto
      // ioredis reconecte.
      this.subscriberReady = false;
    }
  }

  private channel(buildRunId: string): string {
    return `builder:runs:events:${buildRunId}`;
  }

  private toPublicEvent(entity: BuildRunEventEntity): BuilderRunEvent {
    return {
      id: entity.id,
      buildRunId: entity.buildRunId,
      sequence: Number(entity.sequence),
      eventType: entity.eventType,
      runStatus: entity.runStatus,
      message: entity.message,
      payload: entity.payload,
      createdAt: entity.createdAt.toISOString(),
    };
  }
}
