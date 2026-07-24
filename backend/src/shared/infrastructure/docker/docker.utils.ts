/**
 * @fileoverview Orquestación de contenedores y sandbox Docker (docker.utils).
 *
 * @module docker.utils
 */

import type { CommandRunResult } from './command-runner.util';

export function buildDockerLabelArgs(
  labels?: Record<string, string>,
): string[] {
  return Object.entries(labels ?? {}).flatMap(([key, value]) => [
    '--label',
    `${key}=${value}`,
  ]);
}

export function buildDockerFilterArgs(
  labels?: Record<string, string>,
): string[] {
  return Object.entries(labels ?? {}).flatMap(([key, value]) => [
    '--filter',
    `label=${key}=${value}`,
  ]);
}

export function normalizeDockerCommandError(result: CommandRunResult): string {
  if (result.timedOut) {
    return 'timeout';
  }
  return (
    result.stderr.trim() ||
    result.stdout.trim() ||
    `exitCode=${result.exitCode}`
  );
}

export function isMissingDockerResource(
  result: Pick<CommandRunResult, 'stdout' | 'stderr' | 'timedOut' | 'exitCode'>,
  resourcePattern: RegExp,
): boolean {
  if (result.timedOut || result.exitCode === 0) {
    return false;
  }
  return (
    resourcePattern.test(result.stderr || '') ||
    resourcePattern.test(result.stdout || '')
  );
}

export function parseDockerJsonArray<T>(raw: string): T[] {
  return JSON.parse(raw || '[]') as T[];
}

export function parseDockerJsonLines<T>(raw: string): T[] {
  return raw
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}
