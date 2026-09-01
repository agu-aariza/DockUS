# Componentes de detalle de proyecto (`projects/components/`)

> **Resumen rápido:** Las piezas visuales que `TeacherProjectsPanel.tsx` compone para mostrar un proyecto concreto: cabecera, resumen, rúbrica, suite de tests y profesores asignados.

---

## Los siete ficheros

| Fichero | Qué muestra |
| --- | --- |
| `ProjectListItem.tsx` | Fila de la lista de proyectos (vista general del panel). |
| `ProjectDetailHeader.tsx` | Cabecera del panel de detalle: título, estado, fechas, acciones rápidas. |
| `ProjectOverview.tsx` | Resumen del proyecto seleccionado — punto de entrada del panel de detalle. |
| `ProjectSubPanels.tsx` | Contenedor de pestañas/secciones secundarias del detalle. |
| `RubricEditor.tsx` | Editor interactivo de los criterios de rúbrica que se envían al LLM evaluador. |
| `ProjectSuiteSection.tsx` | Subida y gestión de la suite de tests del profesor (`TEACHER_TESTS`). |
| `ProjectTeachersSection.tsx` | Añadir/quitar profesores con permiso de administración sobre el proyecto (`POST/DELETE /projects/:id/teachers/:teacherId`). |

`progress/` (subcarpeta) es un grupo separado y más grande, centrado en el libro de notas — ver su propio README.

## Cómo trabajar aquí

```bash
npm run test -- test/unit/projects/components
```

## Ver también

- [`progress/README.md`](progress/README.md) — libro de notas y gráficos de progreso.
- [`../README.md`](../README.md) — visión general del panel de proyectos.
