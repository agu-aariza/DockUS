import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';

import { BuildRunChatMessage } from '../entities/build-run-chat-message.entity';
import { BuildRun } from '../entities/build-run.entity';
import { BuildRunArtifact, BuildRunArtifactType } from '../entities/build-run-artifact.entity';
import {
  ILlmGenerationService,
  LLM_GENERATION_SERVICE,
} from '../../../../../shared/infrastructure/ai/llm-generation.token';
import { PromptRegistryService, PromptId } from '../../../../../shared/infrastructure/ai/prompt-registry.service';
import { MinioStorageService } from '../../../../../shared/infrastructure/storage/minio-storage.service';
import { resolveBuilderModelProfile } from './builder-llm-model-profile';

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
    @Inject(LLM_GENERATION_SERVICE)
    private readonly llmService: ILlmGenerationService,
    private readonly promptRegistryService: PromptRegistryService,
    private readonly minioStorageService: MinioStorageService,
    private readonly configService: ConfigService,
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

    const userMessage = this.chatMessageRepository.create({
      buildRunId,
      sender: 'user',
      message: messageText,
    });
    await this.chatMessageRepository.save(userMessage);

    try {
      const assistantReplyText = await this.generateTutorReply(run, history, messageText);

      const assistantMessage = this.chatMessageRepository.create({
        buildRunId,
        sender: 'assistant',
        message: assistantReplyText,
      });
      await this.chatMessageRepository.save(assistantMessage);

      return assistantMessage;
    } catch (error) {
      this.logger.error(`Error generating tutor response for run ${buildRunId}: ${error.message}`);
      const assistantMessage = this.chatMessageRepository.create({
        buildRunId,
        sender: 'assistant',
        message: 'Disculpa, he tenido un problema interno al procesar tu consulta con el motor de IA. Por favor, inténtalo de nuevo en unos momentos.',
      });
      await this.chatMessageRepository.save(assistantMessage);
      return assistantMessage;
    }
  }

  private async generateTutorReply(
    run: BuildRun,
    history: BuildRunChatMessage[],
    newUserMessage: string,
  ): Promise<string> {
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
        if (userPromptStart !== -1) {
          evaluationContext = fullPromptText.substring(userPromptStart);
        } else {
          evaluationContext = fullPromptText;
        }
      }
    } catch (error) {
      this.logger.warn(`Could not load LLM_EVAL_PROMPT artifact: ${error.message}. Using fallback.`);
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
      evaluationContext = `Resultado final: ${report?.overallOutcome ?? run.status}
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

    let conversationHistoryText = '';
    for (const msg of history) {
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

    const profile = resolveBuilderModelProfile('chat', this.configService);
    const response = await this.llmService.generate({
      stage: 'chat',
      promptId: PromptId.CHAT,
      prompt: fullPrompt,
      systemPrompt,
      profile,
    });

    return response;
  }
}
