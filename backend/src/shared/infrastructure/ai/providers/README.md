# Adaptadores de Proveedores LLM (shared/infrastructure/ai/providers)

> **Resumen rápido:** Implementación de clientes HTTP y adaptadores concretos para proveedores de IA (Google Gemini, Anthropic Claude, OpenAI Compatible).

---

## Propósito y Responsabilidades
Conectar la abstracción del disyuntor LLM con los endpoints REST/SDK específicos de cada proveedor de inteligencia artificial.
- **Clase Base HTTP:** `http-llm-provider.base.ts` para el manejo común de cabeceras, timeouts y reintentos.
- **Adaptadores Específicos:** `gemini-generation.service.ts`, `anthropic-generation.service.ts` y `openai-compatible-generation.service.ts`.

---

## Estructura Interna

```text
.
├── anthropic-generation.service.ts         # Adaptador para modelos Anthropic Claude
├── gemini-generation.service.ts            # Adaptador para modelos Google Gemini
├── http-llm-provider.base.ts               # Clase base abstracta para proveedores HTTP
└── openai-compatible-generation.service.ts # Adaptador para APIs compatibles con OpenAI
```

---

## Flujo de Trabajo / Arquitectura

```text
[ LlmCircuitBreakerService ] ──> [ HttpLlmProviderBase ] ──> [ Gemini / Anthropic / OpenAI Adapter ]
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar tests de proveedores LLM:
```bash
npm run test -- src/shared/infrastructure/ai/providers
```
