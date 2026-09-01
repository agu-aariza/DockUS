# Adaptadores de proveedores LLM (`shared/infrastructure/ai/providers/`)

> **Resumen rápido:** Tres adaptadores HTTP (Anthropic, Gemini, cualquier API compatible con el formato OpenAI) que comparten una clase base común. Bedrock **no** vive aquí — usa el SDK de AWS directamente (`../bedrock-generation.service.ts`), no HTTP genérico, así que no encaja en esta base.

---

## `http-llm-provider.base.ts`: qué comparten los tres adaptadores

Cabeceras de autenticación, timeouts, reintentos y el manejo de errores HTTP comunes viven en esta clase base abstracta — cada adaptador concreto solo implementa la forma específica de la petición/respuesta de su API (el *body* que espera Gemini no es el que espera una API compatible con OpenAI, aunque el transporte HTTP subyacente sea el mismo).

```text
HttpLlmProviderBase (abstracta: timeouts, reintentos, cabeceras comunes)
        │
        ├── AnthropicGenerationService          # API nativa de Anthropic
        ├── GeminiGenerationService                # API de Google Gemini
        └── OpenAiCompatibleGenerationService         # Cualquier endpoint que hable el formato de chat de OpenAI
```

## Por qué "OpenAI-compatible" y no solo "OpenAI"

Muchos proveedores (locales o de terceros) exponen una API que imita el formato de OpenAI sin ser OpenAI — este adaptador cubre esa familia entera con una sola implementación, en vez de necesitar un adaptador por cada proveedor que resulte compatible.

## Cómo trabajar aquí

```bash
npm run test -- test/unit/shared/infrastructure/ai/providers
```

Si añades un proveedor nuevo que hable HTTP simple, extiende `HttpLlmProviderBase` en vez de reimplementar timeouts/reintentos desde cero, e impleméntalo contra `ILlmGenerationService` (`../llm-generation.token.ts`) para que `LlmGenerationRouter` pueda despacharle peticiones.

## Ver también

- [`../README.md`](../README.md) — el router que decide cuál de estos adaptadores usar, y por qué Bedrock queda fuera de esta carpeta.
