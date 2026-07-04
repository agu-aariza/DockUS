# UI Kit — DockUS Frontend

Kit de componentes visuales reutilizables para construir dashboards técnicos, sobrios e institucionales. Solo deben vivir aquí componentes realmente compartidos por más de un módulo o que representen una primitiva clara de interfaz.

## Principios

- Utilidad antes que decoración.
- Tokens consistentes: `app.*`, `primary.*`, `accent.*`, `slate.*`.
- Accesibilidad básica: focus visible, contraste suficiente, labels asociados.
- Props tipadas y API pequeña.
- Sin componentes “por si acaso”: si `knip` lo marca muerto y no hay uso previsto inmediato, se elimina.

## Componentes Activos

| Componente | Archivo | Uso |
|------------|---------|-----|
| `AppShell` | `AppShell.tsx` | Layout raíz: sidebar + header móvil + área de contenido |
| `Button` / `IconButton` | `Button.tsx` | Acciones primarias, secundarias, ghost, danger, success |
| `Alert` | `Alert.tsx` | Mensajes de estado semánticos (info, success, warning, danger) |
| `Badge` | `Layout.tsx` | Etiquetas compactas con variante e icono opcional |
| `StatusBadge` | `StatusBadge.tsx` | Estados semánticos con dot |
| `Card` / `SectionCard` | `Layout.tsx` | Contenedores con header opcional |
| `PageHeader` | `PageHeader.tsx` | Título, subtítulo, acciones y badge de página |
| `DataTable` | `DataTable.tsx` | Tabla genérica tipada con estados empty/loading |
| `SearchInput` | `SearchInput.tsx` | Input de búsqueda con icono y botón de limpiar |
| `StatsOverview` | `StatsOverview.tsx` | Grid de métricas de alto nivel |
| `Tabs` | `Tabs.tsx` | Navegación por tabs con subrayado |
| `ProjectSelectionHub` | `ProjectSelectionHub.tsx` | Selector visual de proyecto/entrega para flujos guiados |
| `VisualPicker` | `VisualPicker.tsx` | Selector visual de opciones con iconos y descripción |

## Convenciones

- Componentes en PascalCase.
- No añadir sombras decorativas salvo en modales, overlays o popovers.
- No introducir tokens legacy (`academic-*`, `brand-*`, `shadow-academic`).
- Al añadir un componente, documentar su uso aquí y verificar que lo consume al menos una pantalla.
