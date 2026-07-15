import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { LLM_PROVIDER_IDS } from '../../../../../shared/infrastructure/ai/llm.types';
import type { LlmProviderId } from '../../../../../shared/infrastructure/ai/llm.types';
import { BUILDER_LLM_ROLES } from '../../domain/ai/builder-llm-roles';
import type { BuilderLlmRole } from '../../domain/ai/builder-llm-roles';

export class LlmProviderConfigDto {
  @ApiProperty({ enum: LLM_PROVIDER_IDS })
  @IsIn(LLM_PROVIDER_IDS)
  providerId!: LlmProviderId;

  @ApiPropertyOptional({
    description:
      'Clave de API en claro. Se cifra en el servidor y no vuelve a salir de él. Omitir para conservar la guardada.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  apiKey?: string;

  @ApiPropertyOptional({ description: 'Borra la clave guardada.' })
  @IsOptional()
  @IsBoolean()
  clearApiKey?: boolean;

  @ApiPropertyOptional({
    description:
      'Solo Bedrock: Access Key ID de AWS. Vacío ⇒ credenciales del entorno o rol IAM.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  awsAccessKeyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  endpoint?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  region?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  modelVersion?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  modelId!: string;

  @ApiProperty({ minimum: 0, maximum: 2 })
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature!: number;

  @ApiProperty({ minimum: 1, maximum: 200_000 })
  @IsNumber()
  @Min(1)
  @Max(200_000)
  maxTokens!: number;

  @ApiProperty({ description: 'USD por millón de tokens de entrada.' })
  @IsNumber()
  @Min(0)
  @Max(10_000)
  inputCostPerMillion!: number;

  @ApiProperty({ description: 'USD por millón de tokens de salida.' })
  @IsNumber()
  @Min(0)
  @Max(10_000)
  outputCostPerMillion!: number;
}

export class LlmRoleMappingsDto {
  @ApiPropertyOptional({ enum: LLM_PROVIDER_IDS, nullable: true })
  @IsOptional()
  @IsIn([...LLM_PROVIDER_IDS, null])
  planner?: LlmProviderId | null;

  @ApiPropertyOptional({ enum: LLM_PROVIDER_IDS, nullable: true })
  @IsOptional()
  @IsIn([...LLM_PROVIDER_IDS, null])
  eval?: LlmProviderId | null;

  @ApiPropertyOptional({ enum: LLM_PROVIDER_IDS, nullable: true })
  @IsOptional()
  @IsIn([...LLM_PROVIDER_IDS, null])
  quality?: LlmProviderId | null;

  @ApiPropertyOptional({ enum: LLM_PROVIDER_IDS, nullable: true })
  @IsOptional()
  @IsIn([...LLM_PROVIDER_IDS, null])
  chatbot?: LlmProviderId | null;
}

export class SaveLlmConfigsDto {
  @ApiProperty({ type: [LlmProviderConfigDto] })
  @IsArray()
  @ArrayMaxSize(LLM_PROVIDER_IDS.length)
  @ValidateNested({ each: true })
  @Type(() => LlmProviderConfigDto)
  providers!: LlmProviderConfigDto[];

  @ApiProperty({ type: LlmRoleMappingsDto })
  @ValidateNested()
  @Type(() => LlmRoleMappingsDto)
  roleMappings!: LlmRoleMappingsDto;
}

export class LlmProviderConfigViewDto {
  @ApiProperty({ enum: LLM_PROVIDER_IDS })
  providerId!: LlmProviderId;

  @ApiProperty({ description: 'Si hay una clave de API guardada.' })
  hasApiKey!: boolean;

  @ApiProperty({
    nullable: true,
    description: 'Últimos 4 caracteres del secreto; nunca el secreto completo.',
  })
  apiKeyLast4!: string | null;

  @ApiProperty({
    nullable: true,
    description:
      'Solo Bedrock: Access Key ID de AWS (identificador, no secreto).',
  })
  awsAccessKeyId!: string | null;

  @ApiProperty({ nullable: true })
  endpoint!: string | null;

  @ApiProperty({ nullable: true })
  region!: string | null;

  @ApiProperty({ nullable: true })
  modelVersion!: string | null;

  @ApiProperty()
  modelId!: string;

  @ApiProperty()
  temperature!: number;

  @ApiProperty()
  maxTokens!: number;

  @ApiProperty()
  inputCostPerMillion!: number;

  @ApiProperty()
  outputCostPerMillion!: number;
}

export class LlmConfigsResponseDto {
  @ApiProperty({ type: [LlmProviderConfigViewDto] })
  providers!: LlmProviderConfigViewDto[];

  @ApiProperty({
    description: 'Proveedor asignado a cada rol del pipeline.',
    enum: BUILDER_LLM_ROLES,
  })
  roleMappings!: Record<BuilderLlmRole, LlmProviderId | null>;

  @ApiProperty({
    description:
      'False si falta LLM_CREDENTIALS_SECRET: el servidor no aceptará claves de API.',
  })
  credentialsEncryptionEnabled!: boolean;
}

export class LlmProviderTestResponseDto {
  @ApiProperty()
  ok!: boolean;

  @ApiProperty({ enum: LLM_PROVIDER_IDS })
  providerId!: LlmProviderId;

  @ApiProperty()
  modelId!: string;

  @ApiProperty()
  latencyMs!: number;

  @ApiProperty({ nullable: true })
  inputTokens!: number | null;

  @ApiProperty({ nullable: true })
  outputTokens!: number | null;

  @ApiProperty({ nullable: true })
  responsePreview!: string | null;

  @ApiProperty({ nullable: true })
  errorCode!: string | null;

  @ApiProperty()
  message!: string;
}
