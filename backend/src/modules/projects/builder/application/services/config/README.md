# Configuración de proveedores LLM (`application/services/config/`)

> **Resumen rápido:** La fuente de verdad de qué proveedor y modelo atiende cada rol del pipeline (`planner`/`eval`/`quality`/`chatbot`), gestionada por un administrador desde la pestaña "Modelos de IA". Vive en `application/` — no en `infrastructure/`, pese a hablar con la base de datos — porque es un caso de uso: solo toca TypeORM a través del puerto `ILlmConfigurationRepository`.

---

## `builder-llm-config.service.ts`

`BuilderLlmConfigService` traduce la configuración persistida (`LlmConfiguration`, una fila por rol) a `LlmModelProfile` + `LlmProviderCredentials`, que es exactamente lo que consume `LlmGenerationRouter` (`shared/infrastructure/ai/`). Tres reglas de negocio importantes:

- **Si un rol no tiene proveedor asignado, cae al perfil de Bedrock por variables de entorno** (`BUILDER_BEDROCK_<STAGE>_MODEL_ID`) — existe un perfil de respaldo, aunque seguirá necesitando credenciales AWS y un modelo disponible.
- **Las claves de API se cifran antes de guardarse** (`SecretCipherService`, AES-256-GCM) y **nunca vuelven a salir en claro** — la vista solo expone `hasApiKey: boolean` y los últimos 4 caracteres, suficiente para que el administrador reconozca cuál configuró sin poder leerla de vuelta.
- **`resolvePricing(providerId, modelId)`** es el método que usa `ai/builder-run-cost.service.ts` para calcular coste — prioriza la tarifa que el propio administrador declaró al configurar el proveedor sobre la tabla de respaldo de `domain/ai/pricing.utility.ts`.

Antes de aceptar un endpoint personalizado (proveedores compatibles con OpenAI que apuntan a una URL propia), valida con `assertSafeLlmEndpoint` (`shared/infrastructure/ai/llm-endpoint-policy.util.ts`) que no apunte a una dirección interna/privada. Ollama es la excepción explícita porque su uso previsto incluye hosts locales; el objetivo es reducir SSRF y exfiltración de credenciales desde una cuenta de administración comprometida.

## `builder-llm-provider-tester.service.ts`

`BuilderLlmProviderTester` prueba una configuración de proveedor de verdad: envía un prompt mínimo ("responde únicamente OK") con un límite corto de tokens y timeout de 30s, y devuelve el resultado real del proveedor — **no simula nada**. Si la clave es inválida o el endpoint no existe, el resultado es el fallo real reportado por el proveedor, no un mensaje genérico inventado por el backend. Es lo que respalda el botón "Probar conexión" del panel de configuración en el frontend (`frontend/src/llm/components/ConnectionTestPanel.tsx`).

## Estructura interna

```text
config/
├── builder-llm-config.service.ts           # Fuente de verdad de la configuración por rol (ver arriba)
└── builder-llm-provider-tester.service.ts    # Prueba de conexión real contra un proveedor configurado
```

## Cómo trabajar aquí

```bash
npm run test -- test/unit/modules/projects/builder/application/services/config
```

Si añades un campo de configuración nuevo por proveedor, recuerda: si es sensible (claves, tokens), debe pasar por `SecretCipherService` antes de persistirse, y la vista de lectura debe seguir exponiendo solo un fragmento, nunca el valor completo.

## Ver también

- [`../ai/README.md`](../ai/README.md) — los servicios que consumen esta configuración para llamar realmente al LLM.
- [`../../../../../../shared/infrastructure/security/README.md`](../../../../../../shared/infrastructure/security/README.md) — `SecretCipherService`, el cifrado real de las credenciales.
- [`../../../domain/ai/README.md`](../../../domain/ai/README.md) — `pricing.utility.ts`, la tabla de tarifas de respaldo.
