# Servicios de IA del Builder (`application/services/ai/`)

> **Resumen rápido:** Los servicios que realmente llaman al LLM en cada etapa del pipeline — evaluación, chat pedagógico, análisis de calidad — más el despachador con *failover* entre proveedores y el cálculo de coste. Es la capa de aplicación que usa el router de `shared/infrastructure/ai/`, no el cliente HTTP en sí.

---

## `builder-llm-dispatcher.service.ts`: la pieza más importante de esta carpeta

El sistema soporta seis proveedores (Bedrock, OpenAI, Azure, Ollama, Anthropic, Gemini) con un proveedor asignado por rol, pero durante mucho tiempo esa redundancia **no se aprovechaba ante un fallo**: si el proveedor titular de un rol empezaba a devolver *rate limit*, el run entero fallaba con los otros cinco proveedores configurados y ociosos. `BuilderLlmDispatcherService.dispatch(...)` resuelve esto: intenta primero el proveedor asignado por el profesor y solo recurre a los demás candidatos configurados cuando el titular está indisponible.

Importa mucho **qué cuenta como "indisponible"** — deliberadamente un conjunto reducido:

```typescript
const PROVIDER_UNAVAILABLE_CODES = new Set(['throttling', 'connectivity']);
// + cualquier error HTTP >= 500
```

**No** incluye `invalid_contract` ni errores de autenticación: una respuesta mal formada o unas credenciales caducadas no mejoran cambiando de proveedor (el segundo proveedor tendría el mismo problema de configuración, o ninguno, ocultando el fallo real detrás de una evaluación hecha con un modelo distinto al que el profesor eligió). Si se agotan todos los candidatos, se propaga el **último** error — el más informativo sobre por qué no se pudo evaluar.

## Los otros cinco ficheros

| Fichero | Qué hace |
| --- | --- |
| `builder-llm-evaluator.service.ts` | Ejecuta las llamadas LLM de las etapas `plan`, `facts` y `evaluation`: compone el prompt (`domain/ai/builder-prompt-composer.ts`), despacha vía `BuilderLlmDispatcherService`, parsea el contrato con los parsers defensivos de `domain/ai/`. |
| `builder-code-quality.service.ts` | Lo mismo para la etapa `quality` — prompt, despacho, parseo del contrato de calidad. |
| `builder-llm-chat.service.ts` | El chat pedagógico post-evaluación (rol `chatbot`): valida que el mensaje no intente extraer directamente "la clave de corrección" de secciones sensibles del prompt de evaluación, persiste la conversación (`BuildRunChatMessage`) y contabiliza su coste. |
| `builder-run-cost.service.ts` | `summarize(usages)` — suma el coste en USD de un `BuildRun` **etapa a etapa**, con la tarifa del proveedor real de *esa* etapa. Calcularlo con la tarifa de una sola etapa para todos los tokens produciría cifras falsas en cuanto hay más de un proveedor configurado en el mismo run (algo que el *failover* de arriba hace posible). |
| `builder-llm-trace.util.ts` | Helpers puros para construir el `BuilderLlmStageTrace`/`BuilderLlmStagePromptSnapshot` que queda persistido de cada llamada — el registro auditable de qué se le pidió exactamente al modelo y con qué perfil respondió. |

## Por qué estos servicios viven en `application/` y no en `shared/infrastructure/ai/`

Cada uno necesita `BuilderLlmConfigService` (`../config/`) para resolver la cadena de proveedores configurada por el profesor para ese rol — es una dependencia del propio dominio del Builder, no infraestructura genérica reutilizable por cualquier módulo. `shared/infrastructure/ai/` sabe *cómo* hablar con un proveedor; esta carpeta sabe *a quién preguntar* y *qué hacer con la respuesta* específicamente para una evaluación del Builder.

## Cómo trabajar aquí

```bash
npm run test -- test/unit/modules/projects/builder/application/services/ai
```

Si añades una etapa nueva que llame al LLM, sigue el patrón de `builder-llm-evaluator.service.ts`: compón el prompt en `domain/ai/`, despacha con `BuilderLlmDispatcherService` (nunca llames al router de `shared/infrastructure/ai/` directamente desde aquí), y registra el *trace* con `builder-llm-trace.util.ts`.

## Ver también

- [`../config/README.md`](../config/README.md) — de dónde sale la configuración de proveedores por rol.
- [`../../../domain/ai/README.md`](../../../domain/ai/README.md) — composición de prompts y parseo de contratos.
- [`../../../../../../shared/infrastructure/ai/README.md`](../../../../../../shared/infrastructure/ai/README.md) — el router y los adaptadores HTTP reales.
- [`../stages/README.md`](../stages/README.md) — quién invoca estos servicios desde cada etapa del pipeline.
