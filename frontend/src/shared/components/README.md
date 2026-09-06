# Componentes compartidos (`shared/components/`)

> **Resumen rápido:** Componentes visuales transversales y primitivas de presentación. Los componentes con conocimiento de reporting, builder, proyectos o entregas viven ahora en su dominio propietario.

---

## La raíz vs. `ui/`: dónde va cada cosa

`shared/components/ui/` y los componentes de esta raíz son agnósticos de dominio: reciben los datos por props y no importan de `features/` ni de los módulos de negocio. La UI de informes compartida por profesor y alumno vive en [`../../reporting/README.md`](../../reporting/README.md), y los estudios de calificación en `deliveries/components/`.

## Componentes transversales

| Componente | Qué es |
| --- | --- |
| `CodePreviewModal.tsx` | Vista rápida genérica de código fuera del explorador completo de `file-preview/`. |
| `TerminalViewer.tsx` | Visor de salida de terminal/consola (reutilizado fuera de `builder/components/live-run/`). |
| `MarkdownContent.tsx` | Render de Markdown con `remark-gfm`, usado por informes y feedback. |
| `Sidebar.tsx` | Barra lateral de navegación compartida entre layouts. |
| `MetricCard.tsx` | Tarjeta de métrica genérica (usada en dashboards de varios dominios). |
| `EmptyState.tsx` / `Skeleton.tsx` | Estados vacío y de carga reutilizados en toda la app. |
| `DangerConfirmModal.tsx` | Modal de confirmación para acciones destructivas (borrar, purgar). |
| `ErrorBoundary.tsx` | Límite de error de React en torno a secciones que pueden fallar sin tumbar la app entera. |

## Las subcarpetas

```text
ui/            # Design system puro — ver ui/README.md
file-preview/  # Visor genérico de código + explorador de ficheros — ver file-preview/README.md
```

## Cómo trabajar aquí

```bash
npm run test -- test/unit/shared/components
```

Antes de añadir un componente aquí, confirma que de verdad se reutiliza entre dominios — si solo lo usa un panel, pertenece a ese dominio (`<dominio>/components/`), no a `shared/`.

## Ver también

- [`ui/README.md`](ui/README.md), [`file-preview/README.md`](file-preview/README.md), [`../../reporting/README.md`](../../reporting/README.md)
