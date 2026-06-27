# backend/src/modules/projects/builder/application/services/

Servicios de aplicación del pipeline de evaluación. Aquí vive la orquestación de casos de uso del builder: encolar runs, preparar workspaces, compilar recetas, componer reportes y persistir artefactos.

## Servicios principales

| Servicio | Función |
|----------|---------|
| `builder-run-commands.service.ts` | **Orquestador principal**. Coordina las fases PLAN → COMPILE → EXECUTION → EVALUATION → QUALITY → REPORT → PERSIST. |
| `builder-recipe-compiler.service.ts` | Convierte el `BuilderPlanContractV2` del LLM en una `CompiledRecipe` con imagen base, comandos `apt`, instalación, ejecución, tests y healthcheck. |
| `builder-hallucination-guard.service.ts` | Detecta evaluaciones positivas del LLM sin evidencia en los logs de ejecución, o con valores numéricos inconsistentes respecto al `expectedOutput`. |
| `builder-report-composer.service.ts` | Compone el informe final: `overallOutcome`, `technicalFeedback`, `coaching` y `llmRecommendations`. |
| `builder-artifact-persister.service.ts` | Persiste prompts, respuestas crudas, contratos parseados, errores y el reporte JSON como artefactos en MinIO; también guarda filas de hallazgos de calidad. |
| `builder-run-queries.service.ts` | Queries de lectura de `BuildRun` con control de acceso por rol. |
| `builder-access.service.ts` | Validación de permisos sobre deliveries, proyectos y runs. |
| `builder-workspace.service.ts` | Prepara el workspace físico descargando fuente del alumno y suite docente desde MinIO. |
| `builder-cache-manager.service.ts` | Calcula volúmenes de caché de dependencias reutilizables entre ejecuciones. |
| `builder-pedagogical.service.ts` | Genera feedback pedagógico a partir de logs de ejecución. |
| `builder-run-support.service.ts` | Helpers transversales: emitir eventos, marcar runs como fallidos, conversiones de error. |
| `builder-plan-runtime-adapter.ts` | Adapta la receta del LLM a la estructura interna usada por el compilador. |

## Tipos compartidos

- `builder-application.types.ts`: DTOs internos de la capa de aplicación (`EnqueueBuildRunResponse`, `ExecuteBuildRunJobData`).

## Notas

- Los servicios de esta carpeta son consumidos principalmente por `BuilderController`, `BuilderProcessor` y otros servicios de aplicación.
- La lógica pura de interacción con el LLM vive en `domain/ai/`; aquí solo se orquesta.
- `BuilderService` fue eliminado en la refactorización; su responsabilidad quedó repartida entre `BuilderRunCommandsService` y los nuevos servicios especializados.
