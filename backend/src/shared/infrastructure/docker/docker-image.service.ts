import { Injectable } from '@nestjs/common';
import { runCommand } from './command-runner.util';
import type { DockerBuildImageOptions } from './docker.types';

@Injectable()
export class DockerImageService {
  async buildImage(imageTag: string, options: DockerBuildImageOptions) {
    return runCommand('docker', ['build', '-t', imageTag, '.'], {
      cwd: options.cwd,
      timeoutMs: options.timeoutMs,
      maxBufferedChars: options.maxBufferedChars ?? 1_500_000,
      onStdoutChunk: options.onStdoutChunk,
      onStderrChunk: options.onStderrChunk,
    });
  }

  async removeImage(
    imageRef: string,
    options: { timeoutMs: number; maxBufferedChars?: number },
  ): Promise<boolean> {
    const result = await runCommand('docker', ['image', 'rm', imageRef], {
      timeoutMs: options.timeoutMs,
      maxBufferedChars: options.maxBufferedChars,
    });
    return !result.timedOut && result.exitCode === 0;
  }

  async tryImageDigest(
    imageRef: string,
    options: { timeoutMs: number; maxBufferedChars?: number },
  ): Promise<string | null> {
    const result = await runCommand(
      'docker',
      ['image', 'inspect', imageRef, '--format', '{{index .RepoDigests 0}}'],
      {
        timeoutMs: options.timeoutMs,
        maxBufferedChars: options.maxBufferedChars,
      },
    );
    if (result.timedOut || result.exitCode !== 0) {
      return null;
    }

    const digest = result.stdout.trim();
    return digest || null;
  }
}
