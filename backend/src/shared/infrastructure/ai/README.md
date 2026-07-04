# backend/src/shared/infrastructure/ai/

Infraestructura de generación de texto con modelos de lenguaje (LLM). Abstrae la generación mediante AWS Bedrock Runtime, único proveedor activo del sistema.

## Archivos principales

| Archivo | Función |
|---------|---------|
| `bedrock-generation.service.ts` | Cliente de AWS Bedrock Runtime para inferencia con Claude. Implementa `ILlmGenerationService`. |
| `llm-generation.token.ts` | Interfaz `ILlmGenerationService`; mantiene el contrato común usado por servicios y tests. |
| `bedrock-request.util.ts` | Helpers y clase de error `BedrockRequestError` para invocaciones a Bedrock. |
| `prompts.json` | **Source of truth** de los prompts del pipeline builder. |
| `prompt-registry.service.ts` | Registro y carga de prompts desde `prompts.json`. |
| `ai.module.ts` | Módulo NestJS global que provee `PromptRegistryService` y `BedrockGenerationService`. |
| `llm.types.ts` | Tipos de perfiles de modelo y contratos de generación. |
| `prompt.types.ts` | Tipos de bundles de prompt. |

## Notas

- `prompts.json` define cada prompt como un bundle con `role`, `task`, `hard_rules`, `schema_contract`, `decision_policy` y `examples`.
- Los servicios de dominio del builder renderizan esos bundles en runtime.
- Ollama fue eliminado como proveedor; toda la inferencia LLM pasa por AWS Bedrock.
