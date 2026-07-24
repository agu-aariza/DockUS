# Módulo de Gestión de Proyectos para Profesores (src/projects)

> **Resumen rápido:** Paneles de creación y configuración de prácticas, edición interactiva de rúbricas de evaluación, cuadro de mandos de progreso y libro de notas.

---

## Propósito y Responsabilidades
Dar soporte al profesorado en el diseño y seguimiento de las tareas de clase.
- **Configuración de Proyectos:** Creación de enunciados, asociación a asignaturas e hitos.
- **Rúbricas y Notas:** Editor visual de rúbricas (`RubricEditor`), libro de calificaciones (`GradebookTable`) y dashboard de progreso (`ProgressDashboard.tsx`).

---

## Estructura Interna

```text
.
├── components/          # Vistas generales, tablas de notas (GradebookTable) y gráficos
│   └── progress/        # Modales de historial y gráficos de distribución
├── features/            # Formularios de creación y modificación de proyectos (ProjectConfigForm)
├── hooks/               # Custom hooks para la gestión de proyectos y asignaciones
├── ProgressDashboard.tsx# Cuadro de mando de progreso y estadísticas de entregas
└── TeacherProjectsPanel.tsx # Panel principal del profesor para gestionar proyectos
```

---

## Flujo de Trabajo / Arquitectura

```text
[ Profesor UI ] ──> [ ProjectConfigForm ] ──> [ RubricEditor ] ──> [ Save Project API ]
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar tests de proyectos:
```bash
npm run test -- src/projects
```
