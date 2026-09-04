# Dominio de IA del Builder (`builder/domain/ai/`)

> **Resumen rápido:** La composición de prompts y el *parseo defensivo* de las respuestas del LLM en cada etapa del pipeline. Vive en `domain/` (no en `infrastructure/`) porque es lógica de negocio pura sobre texto — no habla con proveedores directamente, eso lo hace `application/services/ai/`.

---

## La regla de oro: nunca confíes en que el LLM responda un JSON perfecto

Los parsers de este directorio están escritos asumiendo que el LLM puede devolver JSON mal formado, campos ausentes o texto extra alrededor del JSON. Hacen parseo defensivo, pero un contrato inválido todavía puede producir un error cuando no existe una degradación válida; la política de fallback la decide la etapa consumidora. No debe confundirse parseo defensivo con garantía de que ninguna excepción sea posible.

## Qué hay dentro

```text
ai/
├── builder-prompt-composer.ts          # Ensambla el prompt final por etapa a partir de secciones con prioridad/presupuesto
├── prompt-composer.types.ts              # Tipos del composer: PromptSectionInput, PromptSectionPriority, PromptSectionBudget...
├── builder-llm-roles.ts                    # BUILDER_LLM_ROLES + roleForStage(): el mapeo etapa → rol configurable
├── builder-llm-model-profile.ts              # Perfil de modelo por defecto (fallback si el profesor no configuró nada)
├── pricing.utility.ts                          # Tarifas de referencia + cálculo de coste — ver detalle abajo
├── builder-execution-result.util.ts               # Mapea el resultado crudo de ejecución a una forma estructurada
├── builder-plan-contract.parser.ts                  # Parser defensivo del contrato de la etapa "plan"
├── builder-facts-contract.parser.ts                   # Parser defensivo del contrato de "hechos" (facts)
├── builder-evaluation-contract.parser.ts                # Parser defensivo del contrato de evaluación (parseBuilderEvaluationContractV2)
├── builder-evaluation-contract-v3.parser.ts              # Parser de la versión v3 del contrato de evaluación
├── builder-report-copy-contract.parser.ts                # Parser del texto estructurado de copia del informe
├── builder-code-quality-contract.parser.ts                # Parser defensivo del contrato de calidad
└── parsers/                                                   # Utilidades de parseo compartidas entre los parsers de arriba
    ├── contract-parser.utils.ts                                  # Helpers genéricos de safe-parsing reutilizados por todos
    ├── plan-contract.parser.ts                                     # (variante/soporte del parser de plan)
    └── evaluation-contract.parser.ts                                  # (variante/soporte del parser de evaluación)
```

## `builder-llm-roles.ts`: la diferencia entre "rol" y "etapa"

Un **rol** (`planner`, `eval`, `quality`, `chatbot`) es lo que un administrador elige en la pestaña "Modelos de IA" del frontend — a qué proveedor/modelo concreto se le asigna esa responsabilidad. Una **etapa** (`plan`, `facts`, `evaluation`, `quality`, `reporting`, `chat`) es lo que el pipeline ejecuta internamente. `roleForStage()` traduce de una a otra; `facts`, `evaluation` y `reporting` comparten el rol `eval`, aunque sean llamadas y contratos internos distintos.

## `pricing.utility.ts`: por qué existe una tabla de precios aquí

La tarifa que de verdad se usa para calcular coste es la que el profesor declara por proveedor en la configuración (`application/services/config/`). Esta tabla es solo el **respaldo** para modelos servidos desde variables de entorno sin configuración explícita en base de datos. Decisión deliberada: un modelo desconocido devuelve `null`, nunca una tarifa inventada — es preferible reportar coste `0` (con aviso) que facturar un modelo local al precio de un modelo comercial grande por error.

## `builder-prompt-composer.ts`: por qué los prompts se "componen" en vez de concatenarse

Cada prompt final se arma a partir de secciones con **prioridad** y **presupuesto** de tokens (`PromptSectionInput`, `PromptSectionPriority`, `PromptSectionBudget`): el contexto de la asignación, la rúbrica, el código fuente, el Trace de ejecución, ejemplos *few-shot* seleccionados del catálogo de runtimes (`runtimeCatalogToText`, `selectFewShotExample` de `../runtime-catalog.ts`)... Si todo no cabe en la ventana de contexto del modelo, el composer recorta por prioridad en vez de truncar a ciegas el texto final. El texto **literal** de los prompts no vive aquí — vive en `shared/infrastructure/ai/prompts.json`; este fichero solo decide cómo se ensamblan las piezas y con qué datos se rellenan.

## Cómo trabajar aquí

```bash
npm run test -- test/unit/modules/projects/builder/domain/ai
```

Si el LLM empieza a devolver un contrato con un campo nuevo o distinto, el parser correspondiente es el sitio a tocar — añade el caso de forma defensiva (con su propio test que alimente JSON malformado) en vez de asumir que el modelo siempre respetará el esquema.

## Ver también

- [`../../../../../shared/infrastructure/ai/README.md`](../../../../../shared/infrastructure/ai/README.md) — el router, los adaptadores y `prompts.json`.
- [`../../application/services/README.md`](../../application/services/README.md) — `ai/` (subcarpeta de servicios) es quien realmente invoca al LLM usando lo que compone/parsea este directorio.
