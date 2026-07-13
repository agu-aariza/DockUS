import { EventEmitter } from 'events';
import {
  Injectable,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type Redis from 'ioredis';
import { Repository } from 'typeorm';
import { RedisClientService } from '../../../../../shared/infrastructure/cache/redis-client.service';
import {
  BuilderRunEvent,
  BuilderRunEventsPage,
  BuildRunEventType,
} from '../builder.types';
import { BuildRunEventEntity } from '../entities/build-run-event.entity';
import { BuildRun } from '../entities/build-run.entity';

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
    @InjectRepository(BuildRunEventEntity)
    private readonly eventsRepository: Repository<BuildRunEventEntity>,
    @InjectRepository(BuildRun)
    private readonly buildRunsRepository: Repository<BuildRun>,
    private readonly redisClientService: RedisClientService,
  ) {}

  async onModuleInit(): Promise<void> {
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
    await this.buildRunsRepository
      .createQueryBuilder()
      .update(BuildRun)
      .set({
        latestEventSequence: () =>
          'GREATEST(COALESCE("latestEventSequence", 0), :seq)',
      })
      .where('id = :id', { id: input.buildRunId })
      .setParameter('seq', saved.sequence)
      .execute();

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

    const query = this.eventsRepository
      .createQueryBuilder('event')
      .where('event.buildRunId = :buildRunId', { buildRunId })
      .orderBy('event.sequence', 'ASC')
      .take(boundedLimit + 1);

    if (afterSequence > 0) {
      query.andWhere('event.sequence > :afterSequence', { afterSequence });
    }

    const rows = await query.getMany();
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
