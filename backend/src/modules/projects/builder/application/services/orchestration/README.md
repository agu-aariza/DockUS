# Servicios de Orquestación del Builder (builder/application/services/orchestration)

> **Resumen rápido:** Servicios de control del ciclo de vida de ejecuciones, recuperación de construcciones estancadas, cuotas de gasto y limpieza de imágenes Docker.

---

## Propósito y Responsabilidades
Garantizar la orquestación segura, concurrente y resiliente de los pipelines de evaluación del builder.
- **Ciclo de Vida:** `builder-run-lifecycle.service.ts` y `builder-pipeline-orchestrator.service.ts`.
- **Control de Recursos:** `builder-spend-quota.service.ts`, `builder-image-retention.service.ts` y `builder-stale-run-recovery.service.ts`.
- **Cancelaciones y Métricas:** `builder-run-cancellation.service.ts` y `builder-run-metrics.service.ts`.

---

## Estructura Interna

```text
.
├── builder-image-retention.service.ts    # Limpieza periódica de imágenes Docker huérfanas
├── builder-pipeline-orchestrator.service.ts # Orquestador secuencial del pipeline de fases
├── builder-run-cancellation.service.ts   # Manejo de solicitudes de cancelación de ejecuciones
├── builder-run-commands.service.ts       # Ejecución de comandos del sistema dentro del contenedor
├── builder-run-lifecycle.service.ts      # Transiciones de estado del ciclo de vida de la run
├── builder-run-metrics.service.ts        # Recopilación de métricas de ejecución (tiempo, memoria)
├── builder-run-queries.service.ts        # Consultas de estado de ejecuciones para la API
├── builder-spend-quota.service.ts        # Control de cuota de gasto y límites de cómputo
└── builder-stale-run-recovery.service.ts # Recuperación automática de runs colgadas o interrumpidas
```

---

## Flujo de Trabajo / Arquitectura

```text
[ Queue Task ] ──> [ BuilderPipelineOrchestrator ]
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
    [ RunLifecycle ] [ SpendQuota ] [ StaleRunRecovery ]
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar tests de orquestación del builder:
```bash
npm run test -- src/modules/projects/builder/application/services/orchestration
```
