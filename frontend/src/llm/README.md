# Configuración de proveedores de IA (`src/llm/`)

> **Resumen rápido:** El panel donde un administrador elige qué proveedor LLM (`bedrock`, `azure`, `openai`, `anthropic`, `gemini` u `ollama`) usa cada rol del pipeline (`planner`/`eval`/`quality`/`chatbot`), introduce sus credenciales y prueba la conexión antes de guardarlas.

---

## Estructura interna

```text
llm/
├── LlmConfigPanel.tsx                 # Página principal: una sección por rol configurable
├── components/
│   ├── ProviderSelector.tsx             # Elegir el proveedor para un rol concreto
│   ├── ProviderConfigForm.tsx             # Credenciales/parámetros específicos del proveedor elegido
│   ├── ConnectionTestPanel.tsx              # "Probar conexión" antes de guardar (POST /builder/llm-configs/:id/test)
│   └── Banner.tsx                             # Avisos (p. ej. "sin credenciales configuradas para este rol")
├── hooks/useLlmConfigManagement.ts        # Queries/mutaciones sobre /builder/llm-configs
└── llmConfigConstants.ts                    # LLM_PROVIDER_IDS y PROVIDER_METADATA — fuente única de qué proveedores existen
```

## API del dominio

`api/llmApi.ts` es la fachada HTTP de configuración y prueba de proveedores. Los hooks y componentes del panel la consumen, mientras que el transporte común permanece en `shared/api/http.ts`.

## `llmConfigConstants.ts` es la fuente única — no la dupliques

`PROVIDER_METADATA` (nombre visible, logo, campos de credenciales requeridos por proveedor) es la única fuente de verdad de qué proveedores soporta la plataforma en la UI. `src/landing/LandingPage.tsx` reutiliza estos mismos valores para su sección de "proveedores compatibles" — si añades un proveedor nuevo aquí, aparece automáticamente en la landing sin tocarla. Nunca redeclares la lista de proveedores en otro sitio.

## Las credenciales nunca se guardan en claro

Lo que este panel envía se cifra en el backend con AES-256-GCM antes de persistirse (`shared/infrastructure/security/secret-cipher.service.ts`) — el frontend solo las manda una vez por HTTPS al guardar; no hay ninguna vista que las vuelva a mostrar en claro después. La configuración y la rotación del secreto maestro están descritas en [`docs/security.md`](../../../docs/security.md).

## Cómo trabajar aquí

```bash
npm run test -- test/unit/llm
```

## Ver también

- [`../landing/README.md`](../landing/README.md) — quien reutiliza `PROVIDER_METADATA`.
- [`../../../backend/src/shared/infrastructure/ai/README.md`](../../../backend/src/shared/infrastructure/ai/README.md) — el router de generación que usa esta configuración.
