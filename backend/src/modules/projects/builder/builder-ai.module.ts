/**
 * @fileoverview Servicios de IA, evaluación y composición pedagógica del Builder.
 *
 * El módulo contiene la política de configuración y despacho LLM, además de
 * los servicios que transforman las respuestas del modelo en resultados del
 * dominio. También publica las consultas, eventos y evidencias que necesitan
 * tanto el chat como la composición del pipeline, manteniendo una única
 * dirección de dependencia entre los módulos de composición.
 *
 * @module BuilderAiModule
 */

import { Module } from '@nestjs/common';
import { AiModule } from '../../../shared/infrastructure/ai/ai.module';
import { CacheModule } from '../../../shared/infrastructure/cache/cache.module';
import { ProjectAssignmentPersistenceModule } from '../assignments/project-assignment-persistence.module';
import { BuilderPersistenceModule } from './builder-persistence.module';
import { BuilderRuntimeModule } from './builder-runtime.module';
import { BuilderCodeQualityService } from './application/services/ai/builder-code-quality.service';
import { BuilderLlmChatService } from './application/services/ai/builder-llm-chat.service';
import { BuilderLlmDispatcherService } from './application/services/ai/builder-llm-dispatcher.service';
import { BuilderLlmEvaluatorService } from './application/services/ai/builder-llm-evaluator.service';
import { BuilderRunCostService } from './application/services/ai/builder-run-cost.service';
import { BuilderLlmConfigService } from './application/services/config/builder-llm-config.service';
import { BuilderLlmProviderTester } from './application/services/config/builder-llm-provider-tester.service';
import { BuilderHallucinationGuard } from './application/services/evaluation/builder-hallucination-guard.service';
import { BuilderPedagogicalService } from './application/services/evaluation/builder-pedagogical.service';
import { BuilderQualityAggregationService } from './application/services/evaluation/builder-quality-aggregation.service';
import { BuilderReportComposer } from './application/services/evaluation/builder-report-composer.service';
import { BuilderReportProjectionService } from './application/services/evaluation/builder-report-projection.service';
import { BuilderRunQueriesService } from './application/services/orchestration/builder-run-queries.service';
import { BuilderSpendQuotaService } from './application/services/orchestration/builder-spend-quota.service';
import { BuilderRunEventsService } from './infrastructure/events/builder-run-events.service';
import { EvidenceService } from './infrastructure/evidence/evidence.service';
import { BuilderLogTrimmer } from './infrastructure/utils/builder-log-trimmer.util';

@Module({
  imports: [
    AiModule,
    CacheModule,
    BuilderPersistenceModule,
    BuilderRuntimeModule,
    ProjectAssignmentPersistenceModule,
  ],
  providers: [
    BuilderLlmEvaluatorService,
    BuilderLlmChatService,
    BuilderCodeQualityService,
    BuilderLlmConfigService,
    BuilderLlmProviderTester,
    BuilderLlmDispatcherService,
    BuilderRunCostService,
    BuilderSpendQuotaService,
    BuilderHallucinationGuard,
    BuilderPedagogicalService,
    BuilderReportComposer,
    BuilderReportProjectionService,
    BuilderQualityAggregationService,
    BuilderRunQueriesService,
    BuilderRunEventsService,
    EvidenceService,
    BuilderLogTrimmer,
  ],
  exports: [
    BuilderLlmEvaluatorService,
    BuilderLlmChatService,
    BuilderCodeQualityService,
    BuilderLlmConfigService,
    BuilderLlmProviderTester,
    BuilderLlmDispatcherService,
    BuilderRunCostService,
    BuilderSpendQuotaService,
    BuilderHallucinationGuard,
    BuilderPedagogicalService,
    BuilderReportComposer,
    BuilderReportProjectionService,
    BuilderQualityAggregationService,
    BuilderRunQueriesService,
    BuilderRunEventsService,
    EvidenceService,
    BuilderLogTrimmer,
  ],
})
export class BuilderAiModule {}
