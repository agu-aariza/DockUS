import {
  BuilderExecutionLogBatcher,
  ExecutionLogStream,
} from './builder-execution-log-batcher';

describe('BuilderExecutionLogBatcher', () => {
  const collect = () => {
    const emitted: Array<{ stream: ExecutionLogStream; text: string }> = [];
    const emit = jest.fn(async (stream: ExecutionLogStream, text: string) => {
      emitted.push({ stream, text });
    });
    return { emitted, emit };
  };

  it('agrupa varios fragmentos en un unico evento al descargar', async () => {
    const { emitted, emit } = collect();
    const batcher = new BuilderExecutionLogBatcher(emit, {
      flushIntervalMs: 10_000,
      maxBufferBytes: 1_000_000,
    });

    batcher.push('stdout', 'linea 1\n');
    batcher.push('stdout', 'linea 2\n');
    batcher.push('stderr', 'aviso\n');

    expect(emit).not.toHaveBeenCalled();

    await batcher.flush();

    expect(emitted).toEqual([
      { stream: 'stdout', text: 'linea 1\nlinea 2\n' },
      { stream: 'stderr', text: 'aviso\n' },
    ]);
  });

  it('descarga de inmediato al superar el umbral de tamano', async () => {
    const { emit } = collect();
    const batcher = new BuilderExecutionLogBatcher(emit, {
      flushIntervalMs: 10_000,
      maxBufferBytes: 8,
    });

    batcher.push('stdout', 'abcdefghij');
    await Promise.resolve();

    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith('stdout', 'abcdefghij');
  });

  it('no emite nada cuando no hay texto pendiente', async () => {
    const { emit } = collect();
    const batcher = new BuilderExecutionLogBatcher(emit);

    batcher.push('stdout', '');
    await batcher.flush();

    expect(emit).not.toHaveBeenCalled();
  });
});
/**
 * Pruebas del vaciado de logs pendientes al cerrar una ejecución del Builder.
 */
