# Integración de IA (`shared/infrastructure/ai/`)

> **Resumen rápido:** El cliente LLM real del sistema — un router con *failover* entre cuatro proveedores (Bedrock, Gemini, Anthropic, OpenAI-compatible), un disyuntor (circuit breaker) por proveedor, y el lector de `prompts.json`. Todo lo que `builder/domain/ai/` compone y parsea, este directorio es quien realmente lo envía y recibe.

---

## `llm-generation.router.ts`: el punto de entrada único

Ningún servicio de dominio del Builder depende de Bedrock (ni de ningún proveedor) directamente — todos dependen de `LlmGenerationRouter`, que elige el adaptador concreto según `profile.providerId` (el perfil sale de la configuración que el profesor eligió en la pestaña "Modelos de IA" para ese rol: `planner`/`eval`/`quality`/`chatbot`). Detalle de seguridad importante: **las credenciales viajan en la petición, nunca en el perfil** — el perfil sí se persiste (en los *snapshots* de prompt de cada `BuildRun`, para poder reproducir exactamente qué se le pidió al modelo), así que si las credenciales vivieran ahí quedarían filtradas en el historial.

```text
Servicio de dominio (p. ej. BuilderLlmEvaluatorService)
        │  pide generar con role="eval"
        ▼
LlmGenerationRouter.generate(request, profile)
        │  profile.providerId decide el adaptador
        ├─ 'bedrock' ──▶ BedrockGenerationService (AWS SDK directo, @aws-sdk/client-bedrock-runtime)
        ├─ 'anthropic' ─▶ providers/anthropic-generation.service.ts  ┐
        ├─ 'gemini' ────▶ providers/gemini-generation.service.ts      ├─ todos extienden HttpLlmProviderBase
        └─ 'openai-compatible' ▶ providers/openai-compatible-generation.service.ts ┘
```

## `llm-circuit-breaker.service.ts`: por qué existe además del router

El router decide *qué* proveedor usar según configuración; el circuit breaker decide *si* ese proveedor está sano ahora mismo. Si un proveedor falla repetidamente, el breaker se abre (`llm_circuit_opened`, con `cooldownSeconds`) y las siguientes peticiones a ese proveedor fallan rápido en vez de esperar un timeout completo cada vez — dándole tiempo a recuperarse y evitando que una degradación de Bedrock, por ejemplo, ralentice cada evaluación en curso. Se configura vía `LLM_CIRCUIT_BREAKER_*`.

## `prompt-registry.service.ts`: dónde vive el texto de los prompts

Lee `prompts.json` (en esta misma carpeta) y expone cada prompt como un `PromptBundle` interpolable (`interpolatePromptBundle`/`renderPromptBundle`, `prompt.types.ts`). **El texto literal de un prompt nunca se escribe inline en un `.ts`** — se edita en `prompts.json` y se referencia por `promptId` desde el código. Esto es una convención estricta del repositorio: facilita iterar el texto de los prompts sin tocar TypeScript, y mantiene auditable qué se le pide exactamente al modelo en cada rol (`planner`, `eval`, `quality`, `chatbot`).

## Estructura interna

```text
ai/
├── ai.module.ts                    # Registra router, breaker, prompt registry y los 4 adaptadores
├── llm-generation.router.ts          # El despachador con failover — ver arriba
├── llm-generation.token.ts             # Interfaz ILlmGenerationService + token de inyección
├── llm.types.ts                          # LlmGenerateRequest/Result, LlmProviderId, LlmUsage...
├── llm-circuit-breaker.service.ts          # Disyuntor por proveedor
├── llm-endpoint-policy.util.ts                # Política de timeouts/reintentos por endpoint
├── llm-request.util.ts                          # LlmRequestError + helpers de construcción de petición
├── bedrock-generation.service.ts                  # Adaptador AWS Bedrock (proveedor primario, SDK directo)
├── bedrock-request.util.ts                          # Helpers específicos de la petición a Bedrock
├── prompt-registry.service.ts                         # Lee prompts.json — ver arriba
├── prompt.types.ts                                      # PromptBundle, PromptManifest, interpolación
├── prompts.json                                           # El texto real de todos los prompts (nunca en .ts)
└── providers/                                                # Adaptadores HTTP genéricos — ver providers/README.md
```

## Cómo trabajar aquí

```bash
npm run test -- src/shared/infrastructure/ai
```

Si necesitas cambiar el texto de un prompt, edita `prompts.json` — nunca hardcodees texto de prompt en un `.ts`. Si necesitas soportar un proveedor LLM nuevo, añade un adaptador en `providers/` que implemente `ILlmGenerationService` (extendiendo `HttpLlmProviderBase` si habla HTTP simple) y regístralo en el `switch` de `LlmGenerationRouter`.

## Ver también

- [`providers/README.md`](providers/README.md) — los adaptadores HTTP concretos.
- [`../../../modules/projects/builder/domain/ai/README.md`](../../../modules/projects/builder/domain/ai/README.md) — quién compone y parsea lo que este directorio envía/recibe.
