/**
 * @fileoverview Motor Builder de evaluación asíncrona (builder-llm-chat.service).
 *
 * @module builder-llm-chat.service
 */

import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { BuildRunChatMessage } from '../../../domain/entities/build-run-chat-message.entity';
import { BuildRun } from '../../../domain/entities/build-run.entity';
import { BuildRunArtifactType } from '../../../domain/entities/build-run-artifact.entity';
import type { IBuildRunRepository } from '../../../domain/repositories/build-run.repository.interface';
import { BUILD_RUN_REPOSITORY } from '../../../domain/repositories/build-run.repository.interface';
import type { IBuildRunChatMessageRepository } from '../../../domain/repositories/build-run-chat-message.repository.interface';
import { BUILD_RUN_CHAT_MESSAGE_REPOSITORY } from '../../../domain/repositories/build-run-chat-message.repository.interface';
import type { IBuildRunArtifactRepository } from '../../../domain/repositories/build-run-artifact.repository.interface';
import { BUILD_RUN_ARTIFACT_REPOSITORY } from '../../../domain/repositories/build-run-artifact.repository.interface';
import { BuilderLlmDispatcherService } from './builder-llm-dispatcher.service';
import {
  PromptRegistryService,
  PromptId,
} from '../../../../../../shared/infrastructure/ai/prompt-registry.service';
import type { IObjectStorage } from '../../../domain/ports/object-storage.port';
import { OBJECT_STORAGE } from '../../../domain/ports/object-storage.port';
import { BuilderLlmConfigService } from '../config/builder-llm-config.service';
import { BuilderRunCostService } from './builder-run-cost.service';
import {
  BuilderEvaluationContractV2,
  BuilderReportEntity,
  BuilderStageTokenUsage,
} from '../../../domain/builder.types';
import type { AuthenticatedUser } from '../../../../../auth/interfaces/authenticated-user.interface';
import { BuilderRunQueriesService } from '../orchestration/builder-run-queries.service';
import { toErrorMessage } from '../../../../../../shared/utils/error-message.util';

// Secciones del prompt de evaluación que contienen la clave de corrección del
// docente. El artefacto LLM_EVAL_PROMPT se reutiliza como contexto del Tutor IA
// (visible por el alumno), así que estos bloques se enmascaran antes de
// construir el prompt del tutor: basta un prompt injection para que el modelo
// repita en el chat cualquier texto que reciba como contexto.
const ANSWER_KEY_SECTION_LABELS = ['EXPECTED OUTPUT ORACLE'];

// Etiquetas de sección que emite el compositor (builder-prompt-composer.ts)
// con el formato `ETIQUETA\n<contenido>` separadas por una línea en blanco.
// Se usan como frontera al recortar la sección sensible: el contenido del
// oráculo es texto libre del docente y puede contener líneas en mayúsculas,
// así que no sirve cualquier línea en mayúsculas como fin de sección.
const KNOWN_SECTION_LABELS = [
  'RUNTIME CATALOG',
  'PROFESSOR EXPECTATIONS',
  'EXPECTED OUTPUT ORACLE',
  'RUBRIC INSTRUCTIONS',
  'STUDENT WORKSPACE',
  'FEW-SHOT EXAMPLES',
  'EXECUTION LOGS',
  'SOURCE EXCERPTS',
  'VERIFIED FACTS',
  'PLANNER HYPOTHESIS SUMMARY',
  'ASSIGNMENT CONTEXT',
  'CURRENT ACADEMIC ASSESSMENT',
];

// Tope de preguntas de alumno por run: sin esto, POST /builder/runs/:id/chat
// solo cae en el bucket generico de rate limiting (no especifico), y cada
// turno factura una llamada LLM real — un bucle de mensajes es un DoS de
// coste, no solo de trafico.
const MAX_CHAT_TURNS_PER_RUN = 40;

/**
 * Mensajes de historial que se incrustan en el prompt (10 turnos: pregunta del
 * alumno + respuesta del tutor). Acota el tamaño del prompt por turno, que el
 * tope anterior no limita.
 */
const MAX_HISTORY_MESSAGES = 20;

/**
 * Tope del contexto de evaluación incrustado en el prompt del tutor. El
 * artefacto del prompt de evaluación puede ocupar decenas de miles de
 * caracteres y se repite en cada turno de la conversación.
 */
const MAX_EVALUATION_CONTEXT_CHARS = 8_000;

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Sustituye el contenido de las secciones con la clave de corrección por un
 * marcador, conservando la etiqueta para que el tutor sepa que la sección
 * existe pero no tenga acceso a su contenido.
 */
function redactAnswerKeySections(promptText: string): string {
  const boundary = KNOWN_SECTION_LABELS.map(escapeRegExp).join('|');
  let redacted = promptText;
  for (const label of ANSWER_KEY_SECTION_LABELS) {
    const pattern = new RegExp(
      `(^|\\n\\n)${escapeRegExp(label)}\\n[\\s\\S]*?(?=\\n\\n(?:${boundary})\\n|$)`,
      'g',
    );
    redacted = redacted.replace(
      pattern,
      `$1${label}\n[Redactado: la clave de corrección no se comparte con el Tutor IA.]`,
    );
  }
  return redacted;
}

@Injectable()
export class BuilderLlmChatService {
  private readonly logger = new Logger(BuilderLlmChatService.name);

  constructor(
    @Inject(BUILD_RUN_CHAT_MESSAGE_REPOSITORY)
    private readonly chatMessageRepository: IBuildRunChatMessageRepository,
    @Inject(BUILD_RUN_REPOSITORY)
    private readonly buildRunRepository: IBuildRunRepository,
    @Inject(BUILD_RUN_ARTIFACT_REPOSITORY)
    private readonly artifactRepository: IBuildRunArtifactRepository,
    private readonly llmDispatcher: BuilderLlmDispatcherService,
    private readonly promptRegistryService: PromptRegistryService,
    @Inject(OBJECT_STORAGE)
    private readonly objectStorage: IObjectStorage,
    private readonly llmConfigService: BuilderLlmConfigService,
    private readonly runCostService: BuilderRunCostService,
    private readonly builderRunQueriesService: BuilderRunQueriesService,
  ) {}

  async getChatMessages(
    buildRunId: string,
    actor: AuthenticatedUser,
  ): Promise<BuildRunChatMessage[]> {
    await this.builderRunQueriesService.getRunById(buildRunId, actor);
    return this.chatMessageRepository.findAllByBuildRun(buildRunId);
  }

  async postChatMessage(
    buildRunId: string,
    messageText: string,
    actor: AuthenticatedUser,
  ): Promise<BuildRunChatMessage> {
    const run = await this.builderRunQueriesService.getRunById(
      buildRunId,
      actor,
    );

    const history =
      await this.chatMessageRepository.findAllByBuildRun(buildRunId);
    if (history.length >= MAX_CHAT_TURNS_PER_RUN * 2) {
      throw new BadRequestException(
        `Se alcanzó el límite de ${MAX_CHAT_TURNS_PER_RUN} preguntas al Tutor IA para esta ejecución.`,
      );
    }

    const userMessage = this.chatMessageRepository.create({
      buildRunId,
      sender: 'user',
      message: messageText,
    });
    await this.chatMessageRepository.save(userMessage);

    try {
      const { text, usage } = await this.generateTutorReply(
        run,
        history,
        messageText,
      );

      const assistantMessage = this.chatMessageRepository.create({
        buildRunId,
        sender: 'assistant',
        message: text,
      });
      await this.chatMessageRepository.save(assistantMessage);

      // El chat consume tokens reales del run: si no se acumulan aquí, el coste
      // que ve el profesor se queda congelado en el de la evaluación.
      await this.accrueChatUsage(run, usage);

      return assistantMessage;
    } catch (error) {
      this.logger.error(
        `Error generating tutor response for run ${buildRunId}: ${toErrorMessage(error)}`,
      );
      const assistantMessage = this.chatMessageRepository.create({
        buildRunId,
        sender: 'assistant',
        message:
          'Disculpa, he tenido un problema interno al procesar tu consulta con el motor de IA. Por favor, inténtalo de nuevo en unos momentos.',
      });
      await this.chatMessageRepository.save(assistantMessage);
      return assistantMessage;
    }
  }

  /** Suma el consumo de un mensaje de chat a los contadores del `BuildRun`. */
  private async accrueChatUsage(
    run: BuildRun,
    usage: BuilderStageTokenUsage | null,
  ): Promise<void> {
    if (!usage) {
      return;
    }

    const { inputTokens, outputTokens, costUsd } =
      await this.runCostService.summarize([usage]);

    await this.buildRunRepository.incrementUsage(run.id, {
      inputTokens,
      outputTokens,
      executionCostUsd: costUsd,
    });
  }

  private async generateTutorReply(
    run: BuildRun,
    history: BuildRunChatMessage[],
    newUserMessage: string,
  ): Promise<{ text: string; usage: BuilderStageTokenUsage | null }> {
    let evaluationContext = '';
    try {
      const evalPromptArtifact =
        await this.artifactRepository.findOneByBuildRunAndType(
          run.id,
          BuildRunArtifactType.LLM_EVAL_PROMPT,
        );
      if (evalPromptArtifact) {
        const buffer = await this.objectStorage.getObjectBuffer(
          evalPromptArtifact.bucket,
          evalPromptArtifact.objectKey,
        );
        const fullPromptText = buffer.toString('utf8');
        const userPromptStart = fullPromptText.indexOf('[USER PROMPT]');
        const rawContext =
          userPromptStart !== -1
            ? fullPromptText.substring(userPromptStart)
            : fullPromptText;
        evaluationContext = redactAnswerKeySections(rawContext);
      }
    } catch (error) {
      this.logger.warn(
        `Could not load LLM_EVAL_PROMPT artifact: ${toErrorMessage(error)}. Using fallback.`,
      );
    }

    if (!evaluationContext) {
      const report = run.report as BuilderReportEntity | undefined;
      const llmAssessment = run.llmAssessment as
        BuilderEvaluationContractV2 | undefined;
      const formatList = (items: unknown[]): string =>
        items.length > 0
          ? items
              .map(
                (item, i) =>
                  `${i + 1}. ${typeof item === 'string' ? item : JSON.stringify(item)}`,
              )
              .join('\n')
          : 'Ninguno.';
      const mustFix: unknown[] = report?.coaching?.mustFix ?? [];
      const shouldImprove: unknown[] = report?.coaching?.shouldImprove ?? [];
      const strengths: unknown[] = report?.coaching?.strengths ?? [];
      evaluationContext =
        `Resultado final: ${report?.overallOutcome ?? run.status}
Nota sugerida: ${llmAssessment?.recommendedGrade ?? 'Sin nota'} / 10

BLOQUEOS QUE IMPIDEN APROBAR:
${formatList(mustFix)}

MEJORAS SUGERIDAS:
${formatList(shouldImprove)}

FORTALEZAS IDENTIFICADAS:
${formatList(strengths)}

RESUMEN PEDAGÓGICO:
${llmAssessment?.studentSummary ?? 'No disponible.'}`.trim();
    }

    // El truncado se aplica siempre después de `redactAnswerKeySections`: cortar
    // solo puede eliminar texto, nunca revelar una sección redactada.
    if (evaluationContext.length > MAX_EVALUATION_CONTEXT_CHARS) {
      evaluationContext = `${evaluationContext.slice(
        0,
        MAX_EVALUATION_CONTEXT_CHARS,
      )}\n...[contexto truncado]`;
    }

    // El tope de turnos (MAX_CHAT_TURNS_PER_RUN) acota cuántas veces se puede
    // preguntar, no cuánto ocupa cada pregunta: concatenar el historial completo
    // hace que el coste crezca de forma cuadrática con la conversación y puede
    // desbordar la ventana del modelo. Se conservan los últimos turnos, que son
    // los que dan continuidad a la conversación.
    const recentHistory = history.slice(-MAX_HISTORY_MESSAGES);
    let conversationHistoryText = '';
    if (history.length > recentHistory.length) {
      conversationHistoryText += `(Se omiten ${history.length - recentHistory.length} mensajes anteriores)\n\n`;
    }
    for (const msg of recentHistory) {
      const senderLabel = msg.sender === 'user' ? 'Estudiante' : 'Tutor';
      conversationHistoryText += `${senderLabel}: ${msg.message}\n\n`;
    }

    const systemPrompt = this.promptRegistryService.getPrompt(PromptId.CHAT);

    const fullPrompt = `[CONTEXTO DE EVALUACIÓN]
${evaluationContext}

[HISTORIAL DE CONVERSACIÓN]
${conversationHistoryText || '(Sin mensajes anteriores)'}
[CONSULTA DEL ESTUDIANTE]
${newUserMessage}

[RESPUESTA DEL TUTOR — Estructura obligatoria: **Reconocimiento** → **El concepto** → **Por dónde empezar** → **Para reflexionar**]`;

    // Despacho de la petición de chat con conmutación entre proveedores y atribución de consumo.
    const { result, profile } = await this.llmDispatcher.dispatch(
      'chat',
      (candidateProfile, credentials) => ({
        stage: 'chat' as const,
        promptId: PromptId.CHAT,
        prompt: fullPrompt,
        systemPrompt,
        profile: candidateProfile,
        credentials,
      }),
    );
    const { text, usage } = result;

    const inputTokens = usage.inputTokens ?? 0;
    const outputTokens = usage.outputTokens ?? 0;

    return {
      text,
      usage:
        inputTokens === 0 && outputTokens === 0
          ? null
          : {
              stage: 'chat',
              providerId: profile.providerId,
              modelId: profile.modelId,
              inputTokens,
              outputTokens,
            },
    };
  }
}
