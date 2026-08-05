# Componentes compartidos (`shared/components/`)

> **Resumen rápido:** Veinte componentes de negocio reutilizables entre dominios (informes, código, chat pedagógico, paleta de comandos...) en la raíz, más tres subcarpetas especializadas (`ui/`, `report/`, `file-preview/`). La diferencia entre la raíz y `ui/` importa: la raíz puede tener lógica de negocio ligera, `ui/` no.

---

## La raíz vs. `ui/`: dónde va cada cosa

`shared/components/ui/` es la capa de **diseño puro** (`Button`, `AppShell`, `StatusBadge`...) — nunca importa de `api/` ni conoce ningún concepto de dominio. Los ficheros en la **raíz** de `shared/components/` sí pueden conocer conceptos del dominio de evaluación (un `ReportView` sabe lo que es un veredicto pedagógico) pero siguen siendo reutilizables entre varios paneles (profesor y alumno), por eso no viven dentro de un dominio concreto como `student/` o `deliveries/`.

## Los veinte componentes de la raíz

| Componente | Qué es |
| --- | --- |
| `ReportView.tsx` | El informe de evaluación consolidado, la vista más reutilizada del sistema (aparece en `deliveries/`, `student/`, `builder/`). |
| `PedagogicalReport.tsx` | La sección de feedback pedagógico dentro del informe. |
| `ProfessionalVerdict.tsx` | El veredicto final (Apto/Necesita mejoras/No apto) con su justificación. |
| `TeacherGradingStudio.tsx` | El "estudio" de calificación combinado usado por el profesor. |
| `TeacherHighlights.tsx` | Puntos destacados automáticos para revisión rápida del profesor. |
| `AssessmentContextSummary.tsx` | Resumen del contexto de la evaluación (proyecto, rúbrica aplicada). |
| `CoachingSummary.tsx` / `TutorChatBlock.tsx` | Resumen y bloque de chat del tutor pedagógico (rol `chatbot`). |
| `GradeBreakdownChart.tsx` | Desglose visual de cómo se compuso la nota final. |
| `Glossary.tsx` | Tooltips de términos técnicos, alimentado por `shared/data/glossary.ts`. |
| `CodePreviewModal.tsx` / `CodeSnippet.tsx` | Vista rápida de código fuera del explorador completo de `file-preview/`. |
| `TerminalViewer.tsx` | Visor de salida de terminal/consola (reutilizado fuera de `builder/components/live-run/`). |
| `MarkdownContent.tsx` | Render de Markdown con `remark-gfm`, usado por informes y feedback. |
| `CommandPalette.tsx` | Paleta de comandos global (⌘K), navegación rápida entre paneles. |
| `Sidebar.tsx` | Barra lateral de navegación compartida entre layouts. |
| `MetricCard.tsx` | Tarjeta de métrica genérica (usada en dashboards de varios dominios). |
| `EmptyState.tsx` / `Skeleton.tsx` | Estados vacío y de carga reutilizados en toda la app. |
| `DangerConfirmModal.tsx` | Modal de confirmación para acciones destructivas (borrar, purgar). |
| `ErrorBoundary.tsx` | Límite de error de React en torno a secciones que pueden fallar sin tumbar la app entera. |

## Las tres subcarpetas

```text
ui/            # Design system puro — ver ui/README.md
report/           # Badges/tarjetas de informe — ver report/README.md
file-preview/       # Visor de código + explorador de ficheros — ver file-preview/README.md
```

## Cómo trabajar aquí

```bash
npm run test -- src/shared/components
```

Antes de añadir un componente aquí, confirma que de verdad se reutiliza entre dominios — si solo lo usa un panel, pertenece a ese dominio (`<dominio>/components/`), no a `shared/`.

## Ver también

- [`ui/README.md`](ui/README.md), [`report/README.md`](report/README.md), [`file-preview/README.md`](file-preview/README.md)
