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
import type { IBuildRunRepository } from '../../../domain/repositories/build-run.repository.interface';
import { BUILD_RUN_REPOSITORY } from '../../../domain/repositories/build-run.repository.interface';
import type { IBuildRunChatMessageRepository } from '../../../domain/repositories/build-run-chat-message.repository.interface';
import { BUILD_RUN_CHAT_MESSAGE_REPOSITORY } from '../../../domain/repositories/build-run-chat-message.repository.interface';
import { BuilderLlmDispatcherService } from './builder-llm-dispatcher.service';
import {
  PromptRegistryService,
  PromptId,
} from '../../../../../../shared/infrastructure/ai/prompt-registry.service';
import { BuilderRunCostService } from './builder-run-cost.service';
import { BuilderStageTokenUsage } from '../../../domain/builder.types';
import type { AuthenticatedUser } from '../../../../../auth/interfaces/authenticated-user.interface';
import { BuilderRunQueriesService } from '../orchestration/builder-run-queries.service';
import { toErrorMessage } from '../../../../../../shared/utils/error-message.util';
import type { StudentReportView } from '@educodeai/contracts';

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

function buildStudentEvaluationContext(report: StudentReportView): string {
  const formatList = (items: string[]): string =>
    items.length > 0
      ? items.map((item) => `- ${item}`).join('\n')
      : '- Ninguno.';
  const rubric = report.rubric.map(
    (criterion) =>
      `- ${criterion.name} [${criterion.status}]: ${criterion.explanation}`,
  );
  const evidence = report.evidence.map(
    (item) => `- ${item.summary}${item.detail ? `: ${item.detail}` : ''}`,
  );

  return [
    `Resultado: ${report.outcome}`,
    `Nota ${report.grade.status === 'OFFICIAL' ? 'oficial' : 'provisional'}: ${report.grade.value ?? 'Sin nota'} / 10`,
    '',
    'LOGROS:',
    formatList(report.narrative.achievements),
    '',
    'BLOQUEOS:',
    formatList(report.blockers.map((item) => item.title)),
    '',
    'PRÓXIMOS PASOS:',
    formatList(report.nextSteps),
    '',
    'RÚBRICA EXPLICADA:',
    rubric.length > 0 ? rubric.join('\n') : '- No disponible.',
    '',
    'EVIDENCIA SEGURA:',
    evidence.length > 0 ? evidence.join('\n') : '- No disponible.',
    '',
    'LIMITACIONES:',
    formatList(report.limitations),
  ].join('\n');
}

@Injectable()
export class BuilderLlmChatService {
  private readonly logger = new Logger(BuilderLlmChatService.name);

  constructor(
    @Inject(BUILD_RUN_CHAT_MESSAGE_REPOSITORY)
    private readonly chatMessageRepository: IBuildRunChatMessageRepository,
    @Inject(BUILD_RUN_REPOSITORY)
    private readonly buildRunRepository: IBuildRunRepository,
    private readonly llmDispatcher: BuilderLlmDispatcherService,
    private readonly promptRegistryService: PromptRegistryService,
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
        actor,
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
    actor: AuthenticatedUser,
  ): Promise<{ text: string; usage: BuilderStageTokenUsage | null }> {
    let evaluationContext: string;
    try {
      // El Tutor IA es una superficie de alumno incluso si lo abre un docente.
      // Su contexto procede únicamente de la proyección pública allowlist.
      const report = await this.builderRunQueriesService.getReportView(
        run.id,
        actor,
        'student',
      );
      if (report.audience !== 'student') {
        throw new Error('La proyección del Tutor IA no es de alumno.');
      }
      evaluationContext = buildStudentEvaluationContext(report);
    } catch (error) {
      this.logger.warn(
        `Could not load student report projection for Tutor IA: ${toErrorMessage(error)}. Using safe fallback.`,
      );
      evaluationContext = `Resultado técnico del run: ${run.status}. El informe pedagógico seguro no está disponible todavía; orienta al alumno sin inventar datos de evaluación.`;
    }

    // El truncado se aplica sobre una proyección ya segura y solo elimina texto.
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
