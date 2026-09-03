/**
 * @fileoverview Infraestructura de clientes y despacho de LLMs (prompt-registry.service).
 *
 * @module prompt-registry.service
 */

import { Injectable, Logger } from '@nestjs/common';
import { readFileSync, existsSync } from 'fs';
import * as path from 'path';
import {
  interpolatePromptBundle,
  PromptBundle,
  PromptManifest,
  renderPromptBundle,
} from './prompt.types';
import { toErrorMessage } from '../../utils/error-message.util';

export enum PromptId {
  PLAN = 'plan',
  FACTS = 'facts',
  EVAL = 'eval',
  REPORTING = 'reporting',
  TECHNICAL_FEEDBACK = 'technical-feedback',
  CHAT = 'chat',
}

@Injectable()
export class PromptRegistryService {
  private readonly logger = new Logger(PromptRegistryService.name);
  private readonly prompts = new Map<PromptId, PromptBundle>();

  constructor() {
    this.loadFromManifest();
  }

  private loadFromManifest() {
    let manifestPath = path.resolve(__dirname, 'prompts.json');

    if (!existsSync(manifestPath)) {
      // Fallback for NestJS watch mode where assets copy might lag behind bootstrap
      const srcPath = path.resolve(
        process.cwd(),
        'src/shared/infrastructure/ai/prompts.json',
      );
      if (existsSync(srcPath)) {
        manifestPath = srcPath;
        this.logger.warn(
          `Loaded prompts.json from src fallback: ${manifestPath}`,
        );
      } else {
        this.logger.error(
          `Prompt manifest not found at ${manifestPath} or ${srcPath}`,
        );
        return;
      }
    }

    try {
      const rawData = readFileSync(manifestPath, 'utf8');
      const manifest = JSON.parse(rawData) as PromptManifest;

      for (const [key, value] of Object.entries(manifest)) {
        this.prompts.set(key as PromptId, value);
      }

      this.logger.log(
        `Prompt registry initialized with ${this.prompts.size} prompts from JSON.`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to load prompt manifest: ${toErrorMessage(error)}`,
      );
    }
  }

  getPrompt(id: PromptId, variables?: Record<string, string>): string {
    const bundle = this.getPromptBundle(id, variables);
    return renderPromptBundle(bundle);
  }

  getPromptBundle(
    id: PromptId,
    variables?: Record<string, string>,
  ): PromptBundle {
    const basePrompt = this.prompts.get(id);
    if (!basePrompt) {
      throw new Error(`Prompt with ID ${id} not found in registry.`);
    }

    if (!variables) {
      return basePrompt;
    }

    return interpolatePromptBundle(basePrompt, variables);
  }
}
