import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PostChatMessageDto {
  @ApiProperty({
    description: 'Texto de la consulta para el Tutor IA',
    example: '¿Por qué falló el test de división por cero?',
  })
  @IsString()
  @IsNotEmpty()
  message!: string;
}
