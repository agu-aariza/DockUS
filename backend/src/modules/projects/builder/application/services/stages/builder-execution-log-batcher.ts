/**
 * @fileoverview Agrupa los chunks de salida de la ejecución en eventos LOG_CHUNK.
 *
 * Contexto:
 * - El contenedor de ejecución emite stdout/stderr en fragmentos pequeños y
 *   frecuentes. Persistir un evento por fragmento supone, por cada línea de log,
 *   un INSERT en `build_run_events`, un UPDATE de la secuencia y un PUBLISH a
 *   Redis: es el primer cuello de botella del sistema bajo carga real.
 * - Este batcher acumula el texto por flujo y lo descarga como un único evento
 *   cada `flushIntervalMs` o al superar `maxBufferBytes`, sin cambiar nada de lo
 *   que ve el usuario (el frontend reconstruye el log concatenando los payloads).
 *
 * @module BuilderExecutionLogBatcher
 */

export type ExecutionLogStream = 'stdout' | 'stderr';

interface BuilderExecutionLogBatcherOptions {
  flushIntervalMs?: number;
  maxBufferBytes?: number;
}

const DEFAULT_FLUSH_INTERVAL_MS = 200;
const DEFAULT_MAX_BUFFER_BYTES = 16 * 1024;

export class BuilderExecutionLogBatcher {
  private readonly buffers: Record<ExecutionLogStream, string> = {
    stdout: '',
    stderr: '',
  };
  private timer: NodeJS.Timeout | null = null;
  private readonly flushIntervalMs: number;
  private readonly maxBufferBytes: number;

  constructor(
    private readonly emit: (
      stream: ExecutionLogStream,
      text: string,
    ) => Promise<void>,
    options: BuilderExecutionLogBatcherOptions = {},
  ) {
    this.flushIntervalMs = options.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS;
    this.maxBufferBytes = options.maxBufferBytes ?? DEFAULT_MAX_BUFFER_BYTES;
  }

  push(stream: ExecutionLogStream, text: string): void {
    if (!text) {
      return;
    }
    this.buffers[stream] += text;

    if (this.bufferedBytes() >= this.maxBufferBytes) {
      void this.flush();
      return;
    }
    this.scheduleFlush();
  }

  /** Descarga inmediatamente todo lo pendiente. Debe llamarse al terminar. */
  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    const pending: Array<Promise<void>> = [];
    for (const stream of ['stdout', 'stderr'] as const) {
      const text = this.buffers[stream];
      if (text) {
        this.buffers[stream] = '';
        pending.push(this.emit(stream, text));
      }
    }

    await Promise.all(pending);
  }

  private scheduleFlush(): void {
    if (this.timer) {
      return;
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, this.flushIntervalMs);
    // No mantener vivo el proceso solo por el temporizador del batcher.
    this.timer.unref?.();
  }

  private bufferedBytes(): number {
    return this.buffers.stdout.length + this.buffers.stderr.length;
  }
}
