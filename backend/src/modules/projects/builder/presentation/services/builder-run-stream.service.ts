import { Injectable } from '@nestjs/common';
import type { Response } from 'express';
import type { AuthenticatedUser } from '../../../../auth/interfaces/authenticated-user.interface';
import { BuilderService } from '../../application/builder.service';

@Injectable()
export class BuilderRunStreamService {
  constructor(private readonly builderService: BuilderService) {}

  async openRunEventStream(input: {
    buildRunId: string;
    afterSequence: number;
    actor: AuthenticatedUser;
    response: Response;
  }): Promise<void> {
    const { buildRunId, afterSequence, actor, response } = input;
    const backlog = await this.builderService.listRunEvents(
      buildRunId,
      actor,
      afterSequence,
      500,
    );
    const unsubscribe = await this.builderService.subscribeToRunEvents(
      buildRunId,
      actor,
      (event) => {
        this.writeEvent(response, 'run-event', event);
      },
    );

    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.flushHeaders?.();

    this.writeEvent(response, 'ready', {
      latestSequence: backlog.latestSequence,
    });
    backlog.events.forEach((event) => {
      this.writeEvent(response, 'run-event', event);
    });

    const heartbeat = setInterval(() => {
      this.writeEvent(response, 'heartbeat', {});
    }, 15000);

    response.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
      response.end();
    });
  }

  private writeEvent(
    response: Response,
    eventName: string,
    payload: unknown,
  ): void {
    response.write(`event: ${eventName}\n`);
    response.write(`data: ${JSON.stringify(payload)}\n\n`);
  }
}
