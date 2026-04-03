import { spawn } from 'child_process';

export interface CommandRunOptions {
  cwd?: string;
  timeoutMs: number;
  maxBufferedChars?: number;
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
      stdio: ['ignore', 'pipe', 'pipe'],
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

    child.stdout.on('data', (chunk: Buffer) => {
      stdout = appendBuffer(stdout, chunk);
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderr = appendBuffer(stderr, chunk);
    });

    child.on('error', (error) => {
      clearTimeout(timer);
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

export function buildLogTail(logText: string, maxLines: number): string[] {
  return logText
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)
    .slice(-maxLines);
}
