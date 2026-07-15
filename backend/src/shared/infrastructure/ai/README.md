## Responsabilidad del Módulo
Abstraer la generación de texto con modelos de lenguaje (LLM) tras una interfaz común (`ILlmGenerationService`), enrutando cada llamada al proveedor que corresponda: AWS Bedrock, OpenAI, Azure OpenAI, Anthropic, Google Gemini u Ollama. También gestiona la carga y parseo de todos los prompts usados en el sistema y el cifrado de secretos (`SecretCipherService`).

## Lo que este módulo NO hace (Anti-Goals) ⚠️
- NO contiene prompts hardcodeados en el código TypeScript (todo va en `prompts.json`).
- NO incluye lógica de negocio ni flujos de evaluación (eso pertenece al módulo Builder o similares).
- NO decide qué proveedor usa cada etapa ni conoce la base de datos: el perfil (`LlmModelProfile`) y las credenciales llegan en la petición, resueltos por `BuilderLlmConfigService`. `shared/` nunca importa de `modules/`.
- NO persiste ni registra credenciales: la clave viaja en `LlmGenerateRequest.credentials`, jamás en `LlmModelProfile` (el perfil se guarda en los snapshots de prompt del `BuildRun`).

## Conceptos Clave (Glosario)
- **Prompt Bundle**: Conjunto de instrucciones estructuradas (`role`, `task`, `hard_rules`, `schema_contract`) que definen cómo el LLM debe comportarse.
- **Model Profile**: La configuración de parámetros de una llamada: proveedor, id del modelo, temperatura, maxTokens, topP y timeout.
- **Router**: `LlmGenerationRouter` elige el adaptador según `profile.providerId`. Es lo que inyectan los servicios del Builder, no un proveedor concreto.
- **Adaptador**: Implementación de un protocolo. `BedrockGenerationService` (SDK de AWS) y, sobre `HttpLlmProviderBase`, `OpenAiCompatibleGenerationService` (OpenAI, Azure, Ollama), `AnthropicGenerationService` y `GeminiGenerationService`.

## Dependencias Externas Clave
- **AWS Bedrock Runtime SDK**: Para la inferencia sobre modelos alojados en AWS.
- **APIs HTTP de OpenAI, Azure OpenAI, Anthropic, Gemini y Ollama**: vía `fetch` con timeout por `AbortController`. Todos los errores se normalizan a `LlmRequestError` (`bedrock-request.util.ts` lo reexporta como `BedrockRequestError` por compatibilidad).

## Efectos Secundarios (Side Effects)
- Consume cuotas y presupuesto del proveedor configurado (AWS Bedrock por defecto).
- Efectúa llamadas HTTP de red que pueden sufrir timeouts.

## Estado / BBDD
- No maneja persistencia en base de datos.
- Mantiene el registro de prompts cargados en memoria desde `prompts.json`.

## Puntos de Entrada (Entrypoints)
- `LlmGenerationRouter`: punto de entrada de toda inferencia; enruta al adaptador del proveedor.
- `BedrockGenerationService` y los adaptadores de `providers/`: implementaciones concretas.
- `PromptRegistryService`: Para obtener y procesar prompts.
- `SecretCipherService`: cifra/descifra secretos en reposo (AES-256-GCM, clave en `LLM_CREDENTIALS_SECRET`).
- Interfaz `ILlmGenerationService` importada por `llm-generation.token.ts`.
