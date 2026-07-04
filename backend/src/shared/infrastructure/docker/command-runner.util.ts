import { spawn } from 'child_process';

interface CommandRunOptions {
  cwd?: string;
  timeoutMs: number;
  maxBufferedChars?: number;
  stdin?: string;
  onStdoutChunk?: (chunk: string) => void;
  onStderrChunk?: (chunk: string) => void;
}

export interface CommandRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
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

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 3000).unref();
    }, options.timeoutMs);

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
      console.error(
        `[runCommand ERROR] Command failed: ${command} ${args.join(' ')}`,
      );
      console.error(`[runCommand ERROR] Details:`, error);
      reject(error);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        exitCode: code ?? -1,
        stdout,
        stderr,
        timedOut,
      });
    });
  });
}
