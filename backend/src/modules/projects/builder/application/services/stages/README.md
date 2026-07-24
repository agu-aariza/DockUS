# Handlers de Etapas del Pipeline de Ejecución (builder/application/services/stages)

> **Resumen rápido:** Manejadores de las etapas del pipeline de evaluación: planificación, compilación, ejecución de tests, análisis de calidad y composición de reportes.

---

## Propósito y Responsabilidades
Implementar los pasos individuales y aislados del flujo de trabajo de evaluación de proyectos.
- **Etapas del Pipeline:** `plan-stage.handler.ts`, `compile-stage.handler.ts`, `execution-stage.handler.ts`, `evaluation-stage.handler.ts`, `quality-stage.handler.ts` y `report-stage.handler.ts`.
- **Agrupación de Logs:** `builder-execution-log-batcher.ts` para enviar logs en lotes hacia la consola en tiempo real.

---

## Estructura Interna

```text
.
├── builder-execution-log-batcher.ts # Agrupador y emisor en lote de logs de ejecución
├── builder-stage.interface.ts         # Interface común de las etapas del pipeline
├── compile-stage.handler.ts           # Etapa de compilación del código fuente
├── evaluation-stage.handler.ts        # Etapa de evaluación pedagógica y rúbricas
├── execution-stage.handler.ts         # Etapa de ejecución de pruebas en contenedor Docker
├── plan-stage.handler.ts              # Etapa de planificación e inspección de archivos
├── quality-stage.handler.ts           # Etapa de análisis estático de calidad y linteo
└── report-stage.handler.ts            # Etapa de generación y guardado del reporte final
```

---

## Flujo de Trabajo / Arquitectura

```text
PlanStage ──> CompileStage ──> ExecutionStage ──> EvaluationStage ──> QualityStage ──> ReportStage
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar tests de los handlers de etapas:
```bash
npm run test -- src/modules/projects/builder/application/services/stages
```
