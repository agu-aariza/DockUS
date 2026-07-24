# Servicios del Builder (builder/application/services)

> **Resumen rápido:** Implementación concreta de servicios de ciclo de vida de ejecuciones, recuperación de ejecuciones estancadas y construcciones de payload de código fuente.

---

## Propósito y Responsabilidades
Servicios individuales encargados de cada fase de la evaluación del builder.
- **Orquestación:** `builder-run-lifecycle.service.ts`, `builder-stale-run-recovery.service.ts`, `builder-image-retention.service.ts`.
- **Servicios de Etapa:** Manejo de etapas de calidad, compilación y pruebas.

---

## Estructura Interna

```text
.
├── ai/             # Evaluación con IA
├── evaluation/     # Guardias de alucinación
├── orchestration/  # Servicios de ciclo de vida y cuotas
├── stages/         # Handlers de cada etapa de compilación/test
└── workspace/      # Construcción del payload de código fuente
```

---

## Flujo de Trabajo / Arquitectura

```text
[ BuilderRunLifecycleService ]
         ├──> [ SourceCodePayloadBuilderService ]
         ├──> [ QualityStageHandler ]
         └──> [ BuilderHallucinationGuardService ]
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar tests de servicios del builder:
```bash
npm run test -- src/modules/projects/builder/application/services
```
