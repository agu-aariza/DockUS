import { BuilderLlmChatService } from './builder-llm-chat.service';
import { PromptRegistryService, PromptId } from '../../../../../shared/infrastructure/ai/prompt-registry.service';
import { OllamaGenerationService } from '../../../../../shared/infrastructure/ai/ollama-generation.service';
import { MinioStorageService } from '../../../../../shared/infrastructure/storage/minio-storage.service';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { BuildRunChatMessage } from '../entities/build-run-chat-message.entity';
import { BuildRun } from '../entities/build-run.entity';
import { BuildRunArtifact, BuildRunArtifactType } from '../entities/build-run-artifact.entity';
import { NotFoundException } from '@nestjs/common';

describe('BuilderLlmChatService', () => {
  let service: BuilderLlmChatService;

  const mockChatMessageRepo = {
    find: jest.fn(),
    create: jest.fn((dto) => ({ id: 'temp-id', ...dto, createdAt: new Date() })),
    save: jest.fn((msg) => Promise.resolve(msg)),
  } as unknown as jest.Mocked<Repository<BuildRunChatMessage>>;

  const mockBuildRunRepo = {
    findOne: jest.fn(),
  } as unknown as jest.Mocked<Repository<BuildRun>>;

  const mockArtifactRepo = {
    findOne: jest.fn(),
  } as unknown as jest.Mocked<Repository<BuildRunArtifact>>;

  const mockOllamaService = {
    generate: jest.fn(),
  } as unknown as jest.Mocked<OllamaGenerationService>;

  const mockPromptRegistry = {
    getPrompt: jest.fn(() => 'SYSTEM_CHAT_PROMPT'),
  } as unknown as jest.Mocked<PromptRegistryService>;

  const mockMinioService = {
    getObjectBuffer: jest.fn(),
  } as unknown as jest.Mocked<MinioStorageService>;

  const mockConfigService = {
    get: jest.fn((key: string, fallback?: any) => fallback),
  } as unknown as jest.Mocked<ConfigService>;

  beforeEach(() => {
    jest.clearAllMocks();

    service = new BuilderLlmChatService(
      mockChatMessageRepo,
      mockBuildRunRepo,
      mockArtifactRepo,
      mockOllamaService,
      mockPromptRegistry,
      mockMinioService,
      mockConfigService,
    );
  });

  describe('getChatMessages', () => {
    it('should query messages sorted by createdAt ASC', async () => {
      const messages = [
        { id: '1', message: 'hola' },
        { id: '2', message: 'adios' },
      ];
      mockChatMessageRepo.find.mockResolvedValue(messages as any);

      const result = await service.getChatMessages('run-id');

      expect(mockChatMessageRepo.find).toHaveBeenCalledWith({
        where: { buildRunId: 'run-id' },
        order: { createdAt: 'ASC' },
      });
      expect(result).toBe(messages);
    });
  });

  describe('postChatMessage', () => {
    it('should throw NotFoundException if build run is missing', async () => {
      mockBuildRunRepo.findOne.mockResolvedValue(null);

      await expect(
        service.postChatMessage('run-id', 'hello'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should query history, store user message, call ollama with context, and store assistant reply', async () => {
      const run = { id: 'run-id', status: 'SUCCESS', report: { overallOutcome: 'PASS', coaching: {} } };
      mockBuildRunRepo.findOne.mockResolvedValue(run as any);
      mockChatMessageRepo.find.mockResolvedValue([]);
      mockArtifactRepo.findOne.mockResolvedValue(null); // No artifact -> Fallback context
      mockOllamaService.generate.mockResolvedValue('Respuesta del tutor');

      const result = await service.postChatMessage('run-id', '¿Cómo soluciono mi error?');

      expect(mockChatMessageRepo.create).toHaveBeenNthCalledWith(1, {
        buildRunId: 'run-id',
        sender: 'user',
        message: '¿Cómo soluciono mi error?',
      });

      expect(mockChatMessageRepo.create).toHaveBeenNthCalledWith(2, {
        buildRunId: 'run-id',
        sender: 'assistant',
        message: 'Respuesta del tutor',
      });

      expect(mockOllamaService.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: 'chat',
          promptId: PromptId.CHAT,
          systemPrompt: 'SYSTEM_CHAT_PROMPT',
          prompt: expect.stringContaining('[CONTEXTO DE EVALUACIÓN]'),
        }),
      );

      expect(result.message).toBe('Respuesta del tutor');
      expect(result.sender).toBe('assistant');
    });

    it('should load context from LLM_EVAL_PROMPT artifact if available in MinIO', async () => {
      const run = { id: 'run-id', status: 'SUCCESS' };
      mockBuildRunRepo.findOne.mockResolvedValue(run as any);
      mockChatMessageRepo.find.mockResolvedValue([]);
      
      const mockArtifact = { bucket: 'b', objectKey: 'k' };
      mockArtifactRepo.findOne.mockResolvedValue(mockArtifact as any);
      mockMinioService.getObjectBuffer.mockResolvedValue(
        Buffer.from('stage: plan\n\n[USER PROMPT]\nContenido del prompt del estudiante', 'utf-8'),
      );
      mockOllamaService.generate.mockResolvedValue('Tutor response');

      await service.postChatMessage('run-id', 'Duda');

      expect(mockMinioService.getObjectBuffer).toHaveBeenCalledWith('b', 'k');
      expect(mockOllamaService.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('Contenido del prompt del estudiante'),
        }),
      );
    });

    it('should use fallback context and return generic response if Ollama generation fails', async () => {
      const run = { id: 'run-id', status: 'FAILED' };
      mockBuildRunRepo.findOne.mockResolvedValue(run as any);
      mockChatMessageRepo.find.mockResolvedValue([]);
      mockArtifactRepo.findOne.mockResolvedValue(null);
      mockOllamaService.generate.mockRejectedValue(new Error('Ollama offline'));

      const result = await service.postChatMessage('run-id', 'Duda');

      expect(result.sender).toBe('assistant');
      expect(result.message).toContain('problema interno');
      expect(mockChatMessageRepo.save).toHaveBeenCalledTimes(2); // saves user message and the fallback error message
    });
  });
});
