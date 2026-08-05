/**
 * @fileoverview Puerto de persistencia de `BuildRunChatMessage`
 * (build-run-chat-message.repository.interface).
 *
 * @module build-run-chat-message.repository.interface
 */

import { BuildRunChatMessage } from '../entities/build-run-chat-message.entity';

/**
 * Puerto real: sin puerto
 * previo, único consumidor real (`BuilderLlmChatService`). Mismo criterio que
 * sin tipos de TypeORM en la firma.
 */
export const BUILD_RUN_CHAT_MESSAGE_REPOSITORY = Symbol(
  'IBuildRunChatMessageRepository',
);

/** Campos aceptados por `Repository.create()` — construcción en memoria, sin persistir. */
export interface NewBuildRunChatMessageData {
  buildRunId: string;
  sender: 'user' | 'assistant';
  message: string;
}

export interface IBuildRunChatMessageRepository {
  /** Historial completo de un run, por antigüedad ascendente. */
  findAllByBuildRun(buildRunId: string): Promise<BuildRunChatMessage[]>;

  create(data: NewBuildRunChatMessageData): BuildRunChatMessage;
  save(message: BuildRunChatMessage): Promise<BuildRunChatMessage>;
}
