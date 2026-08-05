/**
 * @fileoverview Motor Builder de evaluación asíncrona (chat-message.dto).
 *
 * @module chat-message.dto
 */

import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BuildRunChatMessage } from '../../domain/entities/build-run-chat-message.entity';

export const MAX_CHAT_MESSAGE_LENGTH = 4000;

export class PostChatMessageDto {
  @ApiProperty({
    description: 'Texto de la consulta para el Tutor IA',
    example: '¿Por qué falló el test de división por cero?',
    maxLength: MAX_CHAT_MESSAGE_LENGTH,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_CHAT_MESSAGE_LENGTH)
  message!: string;
}

/**
 * los dos endpoints de chat devolvían la entidad TypeORM
 * directamente — la única ruta del builder que saltaba la capa de DTOs
 * (`toBuildRunResponseDto` sí filtra por rol para los runs). Benigno hoy
 * porque la entidad es pequeña, pero acopla la API pública al esquema de
 * BD: añadir una columna a `BuildRunChatMessage` la publicaría sola.
 */
export class ChatMessageResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440111' })
  buildRunId!: string;

  @ApiProperty({ enum: ['user', 'assistant'], example: 'user' })
  sender!: 'user' | 'assistant';

  @ApiProperty({ example: '¿Por qué falló el test de división por cero?' })
  message!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export function toChatMessageResponseDto(
  entity: BuildRunChatMessage,
): ChatMessageResponseDto {
  return {
    id: entity.id,
    buildRunId: entity.buildRunId,
    sender: entity.sender,
    message: entity.message,
    createdAt: entity.createdAt.toISOString(),
  };
}
