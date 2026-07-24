# Capa de Aplicación del Builder (builder/application)

> **Resumen rápido:** Casos de uso y servicios de aplicación para la orquestación y etapas del pipeline de evaluación en Docker.

---

## Propósito y Responsabilidades
Coordinar la ejecución paso a paso de las evaluaciones de proyectos.
- **Servicios de Orquestación:** Ciclo de vida de la ejecución, políticas de retención de imágenes y cuotas de consumo.

---

## Estructura Interna

```text
.
└── services/ # Servicios de orquestación, etapas de evaluación y acceso al workspace
```

---

## Flujo de Trabajo / Arquitectura

```text
[ BuilderProcessor Job ] ──> [ BuilderRunLifecycleService ] ──> [ QualityStageHandler ]
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar tests de aplicación del builder:
```bash
npm run test -- src/modules/projects/builder/application
```
