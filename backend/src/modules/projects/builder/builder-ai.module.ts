/**
 * @fileoverview Servicios de IA, evaluación y composición pedagógica del Builder.
 *
 * El módulo contiene la política de configuración y despacho LLM, además de
 * los servicios que transforman las respuestas del modelo en resultados del
 * dominio. El forwardRef refleja el cruce real entre el chat —que consulta runs—
 * y el pipeline —que consume evaluadores y compositores— sin cambiar ninguno de
 * los contratos de aplicación.
 *
 * @module BuilderAiModule
 */

import { forwardRef, Module } from '@nestjs/common';
import { AiModule } from '../../../shared/infrastructure/ai/ai.module';
import { ProjectAssignmentPersistenceModule } from '../assignments/project-assignment-persistence.module';
import { BuilderPipelineModule } from './builder-pipeline.module';
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
import { BuilderSpendQuotaService } from './application/services/orchestration/builder-spend-quota.service';
import { BuilderLogTrimmer } from './infrastructure/utils/builder-log-trimmer.util';

@Module({
  imports: [
    AiModule,
    BuilderPersistenceModule,
    BuilderRuntimeModule,
    ProjectAssignmentPersistenceModule,
    forwardRef(() => BuilderPipelineModule),
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
    BuilderQualityAggregationService,
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
    BuilderQualityAggregationService,
    BuilderLogTrimmer,
  ],
})
export class BuilderAiModule {}
