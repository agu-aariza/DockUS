import { EventEmitter } from 'events';

import { BuilderController } from '@app/modules/projects/builder/presentation/builder.controller';

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

    let sinkRef: { onReady: (s: number) => void; onEvent: (e: any) => void };
    const unsubscribe = jest.fn();
    const builderRunCommandsService = {} as any;
    const builderRunQueriesService = {
      streamRunEvents: jest
        .fn()
        .mockImplementation(async (_runId, _user, _afterSequence, sink) => {
          sinkRef = sink;
          sink.onReady(1);
          sink.onEvent(firstEvent);
          return { unsubscribe };
        }),
    } as any;
    const builderLlmChatService = {} as any;

    const controller = new BuilderController(
      builderRunCommandsService,
      builderRunQueriesService,
      builderLlmChatService,
      {} as any,
      {} as any,
    );
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

    await controller.getRunEventsStream('run-1', 0, request as any, response);

    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'text/event-stream',
    );
    expect(writes[0]).toContain('event: ready');
    expect(writes[1]).toContain('"studentStage":"building"');

    sinkRef!.onEvent(liveEvent);
    expect(writes[writes.length - 1]).toContain('"studentStage":"completed"');

    request.emit('close');
    expect(unsubscribe).toHaveBeenCalled();
    expect(response.end).toHaveBeenCalled();
  });

  describe('getLatestRunsByDeliveries', () => {
    it('maps the batch service result into role-redacted response DTOs, keyed by deliveryId', async () => {
      const runForA = {
        id: 'run-a',
        deliveryId: 'delivery-a',
        triggeredById: 'teacher-1',
        status: 'SUCCESS',
        latestEventSequence: null,
        llmAssessment: { thought: 'internal reasoning' },
        report: { teacherHighlights: 'staff only', overallOutcome: 'PASS' },
        failureReason: null,
        warnings: [],
        startedAt: null,
        finishedAt: null,
        createdAt: new Date('2026-05-11T10:00:00.000Z'),
        updatedAt: new Date('2026-05-11T10:00:00.000Z'),
        inputTokens: 10,
        outputTokens: 5,
        executionCostUsd: 0.01,
      } as any;

      const builderRunCommandsService = {} as any;
      const builderRunQueriesService = {
        listLatestRunsByDeliveryIds: jest.fn().mockResolvedValue({
          'delivery-a': runForA,
          'delivery-b': null,
        }),
      } as any;
      const builderLlmChatService = {} as any;

      const controller = new BuilderController(
        builderRunCommandsService,
        builderRunQueriesService,
        builderLlmChatService,
        {} as any,
        {} as any,
      );

      const request = {
        user: { userId: 'student-1', role: 'STUDENT' },
      } as any;

      const response = await controller.getLatestRunsByDeliveries(
        { deliveryIds: ['delivery-a', 'delivery-b'] },
        request,
      );

      expect(
        builderRunQueriesService.listLatestRunsByDeliveryIds,
      ).toHaveBeenCalledWith(['delivery-a', 'delivery-b'], request.user);
      expect(response.data['delivery-b']).toBeNull();
      // El actor STUDENT nunca debe recibir llmAssessment/report.teacherHighlights
      // Mantiene la misma redacción por rol que el resto de endpoints de
      // BuildRun.
      expect(response.data['delivery-a']?.llmAssessment).toBeUndefined();
      expect(
        (response.data['delivery-a']?.report as any)?.teacherHighlights,
      ).toBeUndefined();
      expect((response.data['delivery-a']?.report as any)?.overallOutcome).toBe(
        'PASS',
      );
    });
  });
});
