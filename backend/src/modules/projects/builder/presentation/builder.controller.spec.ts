import { EventEmitter } from 'events';

import { BuilderController } from './builder.controller';

describe('BuilderController', () => {
  it('streams backlog events and live events through the existing SSE endpoint', async () => {
    const firstEvent = {
      id: 'event-1',
      buildRunId: 'run-1',
      sequence: 1,
      eventType: 'RUN_STATUS_CHANGED',
      runStatus: 'RUNNING',
      message: 'Analizando arquitectura',
      payload: { studentStage: 'building' },
      createdAt: '2026-05-11T10:00:00.000Z',
    };
    const liveEvent = {
      id: 'event-2',
      buildRunId: 'run-1',
      sequence: 2,
      eventType: 'RUN_COMPLETED',
      runStatus: 'SUCCESS',
      message: 'Evaluacion completada con exito.',
      payload: { studentStage: 'completed' },
      createdAt: '2026-05-11T10:01:00.000Z',
    };

    let liveCallback: ((event: typeof liveEvent) => void) | null = null;
    const unsubscribe = jest.fn();
    const builderService = {
      listRunEvents: jest
        .fn()
        .mockResolvedValueOnce({
          events: [firstEvent],
          latestSequence: 1,
          hasMore: false,
        }),
      subscribeRunEvents: jest.fn().mockImplementation(async (_runId, _user, callback) => {
        liveCallback = callback;
        return unsubscribe;
      }),
    } as any;

    const controller = new BuilderController(builderService);
    const writes: string[] = [];
    const request = new EventEmitter() as EventEmitter & {
      user: { userId: string; role: string };
    };
    request.user = { userId: 'student-1', role: 'STUDENT' };

    const response = {
      setHeader: jest.fn(),
      flushHeaders: jest.fn(),
      write: jest.fn((chunk: string) => {
        writes.push(chunk);
      }),
      end: jest.fn(),
    } as any;

    await controller.getRunEventsStream(
      'run-1',
      0,
      request as any,
      response,
    );

    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'text/event-stream',
    );
    expect(writes[0]).toContain('event: ready');
    expect(writes[1]).toContain('"studentStage":"building"');

    liveCallback?.(liveEvent);
    expect(writes[writes.length - 1]).toContain('"studentStage":"completed"');

    request.emit('close');
    expect(unsubscribe).toHaveBeenCalled();
    expect(response.end).toHaveBeenCalled();
  });
});
