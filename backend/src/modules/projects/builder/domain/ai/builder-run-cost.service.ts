/**
 * @fileoverview Coste en USD de un `BuildRun` a partir del consumo por etapa.
 *
 * Cada etapa puede correr en un proveedor y un modelo distintos, así que el
 * coste se calcula etapa a etapa con la tarifa de *su* proveedor y se suma. Usar
 * la tarifa de una sola etapa para todos los tokens produce cifras falsas en
 * cuanto hay más de un proveedor configurado.
 *
 * @module BuilderRunCostService
 */

import { Injectable, Logger } from '@nestjs/common';
import { BuilderLlmConfigService } from '../../infrastructure/config/builder-llm-config.service';
import { BuilderStageTokenUsage } from '../builder.types';
import { calculateCost } from './pricing.utility';

export interface BuilderRunCostSummary {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

@Injectable()
export class BuilderRunCostService {
  private readonly logger = new Logger(BuilderRunCostService.name);

  constructor(private readonly llmConfigService: BuilderLlmConfigService) {}

  async summarize(
    usages: BuilderStageTokenUsage[],
  ): Promise<BuilderRunCostSummary> {
    const summary: BuilderRunCostSummary = {
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
    };

    for (const usage of usages) {
      const pricing = await this.llmConfigService.resolvePricing(
        usage.providerId,
        usage.modelId,
      );

      if (!pricing) {
        this.logger.warn(
          `Sin tarifa conocida para "${usage.modelId}" (${usage.providerId}); su coste se contabiliza como 0. Declárala en la pestaña "Modelos de IA".`,
        );
      }

      summary.inputTokens += usage.inputTokens;
      summary.outputTokens += usage.outputTokens;
      summary.costUsd += calculateCost(pricing, usage);
    }

    return summary;
  }
}
