# Servicios del Builder (`builder/application/services/`)

> **Resumen rápido:** Nueve subcarpetas, cada una una responsabilidad distinta del pipeline de evaluación. Es el directorio con más código de todo el backend.

---

## Las nueve subcarpetas

| Carpeta | Responsabilidad | Doc dedicada |
| --- | --- | --- |
| `orchestration/` | Ciclo de vida del run, cancelación, cuotas de gasto, recuperación de runs colgados, limpieza de imágenes. El "cerebro" que decide qué pasa y cuándo. | [Sí](orchestration/README.md) |
| `stages/` | Los seis handlers del pipeline (plan/compile/execution/evaluation/quality/report). | [Sí](stages/README.md) |
| `evaluation/` | Guardia anti-alucinación, agregación de calidad, feedback pedagógico, composición del informe final. | [Sí](evaluation/README.md) |
| `workspace/` | Prepara el sistema de ficheros temporal que se monta dentro del contenedor Docker. | [Sí](workspace/README.md) |
| `ai/` | Los servicios que realmente llaman al LLM: dispatcher con *failover* entre proveedores, evaluador, chat pedagógico, análisis de calidad, coste por ejecución. | [Sí](ai/README.md) |
| `compilation/` | `builder-recipe-compiler.service.ts` — traduce la `Recipe` inferida en la etapa de plan a los comandos Docker concretos que ejecutará `ExecutionStage`. | [Sí](compilation/README.md) |
| `artifacts/` | `builder-artifact-persister.service.ts` — guarda los artefactos generados durante la ejecución (logs, ficheros de salida) como `BuildRunArtifact` en storage. | [Sí](artifacts/README.md) |
| `config/` | `builder-llm-config.service.ts` / `builder-llm-provider-tester.service.ts` — CRUD de la configuración de proveedores LLM por rol (pestaña "Modelos de IA" del administrador) y prueba de conectividad. Antes vivía en `infrastructure/` pero se movió aquí porque es un caso de uso (lee/escribe vía el puerto `ILlmConfigurationRepository`), no infraestructura cruda. | [Sí](config/README.md) |
| `support/` | Utilidades de evaluación degradada y fallback de copia de informe cuando el LLM falla o devuelve un contrato inválido. | [Sí](support/README.md) |

## Cómo encajan entre sí en una ejecución típica

```text
orchestration/ (BuilderRunLifecycleService)
   │
   ▼
stages/plan-stage.handler.ts ──▶ ai/ (LLM planner) ──▶ compilation/ (traduce a Recipe ejecutable)
   │
   ▼
stages/execution-stage.handler.ts ──▶ Docker (vía shared/infrastructure/docker/)
   │
   ▼
stages/evaluation-stage.handler.ts ──▶ ai/ (LLM eval) ──▶ evaluation/ (guardia anti-alucinación)
                                              │                    │
                                              ▼                    ▼
                                     support/ (si el LLM falla)   artifacts/ (persiste evidencias)
   │
   ▼
stages/quality-stage.handler.ts ──▶ ai/ (LLM quality) ──▶ evaluation/ (agregación)
   │
   ▼
stages/report-stage.handler.ts ──▶ evaluation/ (composición del informe final)
```

## Cómo trabajar aquí

```bash
npm run test -- test/unit/modules/projects/builder/application/services
```

Antes de añadir un servicio nuevo, decide a cuál de estas nueve responsabilidades pertenece — si no encaja claramente en ninguna, probablemente sea una señal de que el caso de uso está mal delimitado, no de que haga falta una carpeta nueva.

## Ver también

- [`../../README.md`](../../README.md) — visión general del Builder.
