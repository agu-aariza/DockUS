import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { BuildRunChatMessage } from '../../../domain/entities/build-run-chat-message.entity';
import { BuildRun } from '../../../domain/entities/build-run.entity';
import {
  BuildRunArtifact,
  BuildRunArtifactType,
} from '../../../domain/entities/build-run-artifact.entity';
import { BuilderLlmDispatcherService } from './builder-llm-dispatcher.service';
import {
  PromptRegistryService,
  PromptId,
} from '../../../../../../shared/infrastructure/ai/prompt-registry.service';
import { MinioStorageService } from '../../../../../../shared/infrastructure/storage/minio-storage.service';
import { BuilderLlmConfigService } from '../../../infrastructure/config/builder-llm-config.service';
import { BuilderRunCostService } from './builder-run-cost.service';
import { BuilderStageTokenUsage } from '../../../domain/builder.types';

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
    @InjectRepository(BuildRunChatMessage)
    private readonly chatMessageRepository: Repository<BuildRunChatMessage>,
    @InjectRepository(BuildRun)
    private readonly buildRunRepository: Repository<BuildRun>,
    @InjectRepository(BuildRunArtifact)
    private readonly artifactRepository: Repository<BuildRunArtifact>,
    private readonly llmDispatcher: BuilderLlmDispatcherService,
    private readonly promptRegistryService: PromptRegistryService,
    private readonly minioStorageService: MinioStorageService,
    private readonly llmConfigService: BuilderLlmConfigService,
    private readonly runCostService: BuilderRunCostService,
  ) {}

  async getChatMessages(buildRunId: string): Promise<BuildRunChatMessage[]> {
    return this.chatMessageRepository.find({
      where: { buildRunId },
      order: { createdAt: 'ASC' },
    });
  }

  async postChatMessage(
    buildRunId: string,
    messageText: string,
  ): Promise<BuildRunChatMessage> {
    const run = await this.buildRunRepository.findOne({
      where: { id: buildRunId },
    });
    if (!run) {
      throw new NotFoundException('Ejecución no encontrada.');
    }

    const history = await this.getChatMessages(buildRunId);
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
        `Error generating tutor response for run ${buildRunId}: ${error.message}`,
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

    await this.buildRunRepository.increment(
      { id: run.id },
      'inputTokens',
      inputTokens,
    );
    await this.buildRunRepository.increment(
      { id: run.id },
      'outputTokens',
      outputTokens,
    );
    if (costUsd > 0) {
      await this.buildRunRepository.increment(
        { id: run.id },
        'executionCostUsd',
        costUsd,
      );
    }
  }

  private async generateTutorReply(
    run: BuildRun,
    history: BuildRunChatMessage[],
    newUserMessage: string,
  ): Promise<{ text: string; usage: BuilderStageTokenUsage | null }> {
    let evaluationContext = '';
    try {
      const evalPromptArtifact = await this.artifactRepository.findOne({
        where: {
          buildRunId: run.id,
          artifactType: BuildRunArtifactType.LLM_EVAL_PROMPT,
        },
      });
      if (evalPromptArtifact) {
        const buffer = await this.minioStorageService.getObjectBuffer(
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
        `Could not load LLM_EVAL_PROMPT artifact: ${error.message}. Using fallback.`,
      );
    }

    if (!evaluationContext) {
      const report = run.report as any;
      const llmAssessment = run.llmAssessment as any;
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

    // Conmutación entre proveedores (ESC-ALTO-02). El consumo se atribuye al
    // perfil que realmente atendió la llamada, no al asignado al rol: si hubo
    // conmutación, la tarifa aplicable es la del proveedor suplente.
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
