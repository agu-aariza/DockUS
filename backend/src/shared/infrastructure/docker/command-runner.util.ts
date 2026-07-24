import { spawn } from 'child_process';

interface CommandRunOptions {
  cwd?: string;
  timeoutMs: number;
  maxBufferedChars?: number;
  stdin?: string;
  onStdoutChunk?: (chunk: string) => void;
  onStderrChunk?: (chunk: string) => void;
  /** Cancelacion cooperativa: mata el proceso igual que el timeout. */
  signal?: AbortSignal;
}

export interface CommandRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  /**
   * true si `signal` se disparo antes de que el proceso terminara solo.
   * Opcional en el tipo (la implementacion real siempre lo rellena) para no
   * forzar a cada mock existente de `runCommand` en los tests a declararlo.
   */
  aborted?: boolean;
}

export async function runCommand(
  command: string,
  args: string[],
  options: CommandRunOptions,
): Promise<CommandRunResult> {
  const maxBufferedChars = options.maxBufferedChars ?? 250000;

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let aborted = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 3000).unref();
    }, options.timeoutMs);

    const onAbort = (): void => {
      aborted = true;
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 3000).unref();
    };
    if (options.signal?.aborted) {
      // Ya estaba cancelado antes de spawnear: el evento 'abort' no volveria
      // a disparar, hay que tratarlo como si acabara de llegar.
      onAbort();
    } else {
      options.signal?.addEventListener('abort', onAbort);
    }

    const appendBuffer = (current: string, chunk: Buffer): string => {
      const merged = `${current}${chunk.toString('utf8')}`;
      if (merged.length <= maxBufferedChars) {
        return merged;
      }
      return merged.slice(merged.length - maxBufferedChars);
    };

    if (typeof options.stdin === 'string') {
      child.stdin.write(options.stdin);
    }
    child.stdin.end();

    child.stdout.on('data', (chunk: Buffer) => {
      options.onStdoutChunk?.(chunk.toString('utf8'));
      stdout = appendBuffer(stdout, chunk);
    });

    child.stderr.on('data', (chunk: Buffer) => {
      options.onStderrChunk?.(chunk.toString('utf8'));
      stderr = appendBuffer(stderr, chunk);
    });

    child.on('error', (error) => {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
      console.error(
        `[runCommand ERROR] Command failed: ${command} ${args.join(' ')}`,
      );
      console.error(`[runCommand ERROR] Details:`, error);
      reject(error);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
      resolve({
        exitCode: code ?? -1,
        stdout,
        stderr,
        timedOut,
        aborted,
      });
    });
  });
}
