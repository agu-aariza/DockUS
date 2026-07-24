# Submódulo Builder y Orquestador de Evaluaciones (builder)

> **Resumen rápido:** Motor de compilación, ejecución de tests y evaluación automática asistida por IA para las entregas de proyectos en contenedores aislados.

---

## Propósito y Responsabilidades
Ejecutar código no confiable de alumnos de forma aislada y calcular una nota/feedback automatizado.
- **Orquestación de ejecuciones:** Control de ciclo de vida (`BuilderRunLifecycleService`), recuperación de ejecuciones estancadas y límites de cuota de gasto.
- **Evaluación y Feedback:** Guardias anti-alucinaciones de IA (`BuilderHallucinationGuardService`) y verificación de calidad.

---

## Estructura Interna

```text
.
├── application/      # Servicios de aplicación y orquestación de ejecuciones (services/)
├── domain/           # Catálogo de runtimes soportados, capacidades de workers y utilidades
├── infrastructure/   # Eventos de infraestructura y escuchadores
└── presentation/     # Procesador de colas BullMQ (BuilderProcessor) y DTOs
```

---

## Flujo de Trabajo / Arquitectura

```text
[ Queue Task ] ──> [ BuilderProcessor ] ──> [ BuilderRunLifecycleService ]
                                                     │
                                   ┌─────────────────┴─────────────────┐
                                   ▼                                   ▼
                       [ Docker execution ]               [ AI Hallucination Guard ]
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar tests del motor builder:
```bash
npm run test -- src/modules/projects/builder
```
