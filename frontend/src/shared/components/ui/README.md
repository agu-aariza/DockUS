# UI Kit — DockUS Frontend

Kit de componentes visuales reutilizables del frontend de DockUS. Diseñado para construir interfaces técnicas, sobrias e institucionales al estilo de dashboards B2B.

## Principios

- **Utilidad antes que decoración**: cada componente resuelve un problema de interfaz concreto.
- **Tokens consistentes**: se usan los tokens definidos en `tailwind.config.js` (`app.*`, `primary.*`, `accent.*`, `slate.*`).
- **Accesibilidad básica**: focus visible, contraste suficiente, labels asociadas.
- **Composición limpia**: props tipadas con TypeScript, clases condicionales controladas.

## Componentes

| Componente | Archivo | Uso |
|------------|---------|-----|
| `AppShell` | `AppShell.tsx` | Layout raíz: sidebar + header móvil + área de contenido |
| `Button` / `IconButton` | `Button.tsx` | Acciones primarias, secundarias, ghost, danger, success |
| `StatusBadge` | `StatusBadge.tsx` | Estados semánticos (success, warning, danger, running, etc.) |
| `Card` / `SectionCard` | `Layout.tsx` | Contenedores de información con borde sutil |
| `Badge` | `Layout.tsx` | Badge compacto semántico (alias de `StatusBadge`) |
| `PageHeader` | `PageHeader.tsx` | Título, subtítulo, acciones y badge de página |
| `MetricCard` | `../MetricCard.tsx` | Métricas compactas con contexto |
| `StatsOverview` | `StatsOverview.tsx` | Grid de métricas de alto nivel |
| `Tabs` | `Tabs.tsx` | Navegación por tabs con subrayado |
| `DataTable` | `DataTable.tsx` | Tabla genérica tipada con headers, celdas y estados empty/loading |
| `SearchInput` | `SearchInput.tsx` | Input de búsqueda con icono y botón de limpiar |
| `FilterBar` | `FilterBar.tsx` | Barra de búsqueda + filtros select + acciones |
| `EmptyState` | `../EmptyState.tsx` | Estado vacío sobrio con acción opcional |
| `DangerZone` | `DangerZone.tsx` | Panel para acciones destructivas |
| `OperationPanel` / `OperationItem` | `OperationPanel.tsx` | Feed de actividad operativa |
| `ActivityFeed` | `OperationPanel.tsx` | Alias de `OperationPanel` |
| `UserMenu` | `UserMenu.tsx` | Menú de usuario con logout |
| `ProjectListItem` | `ProjectListItem.tsx` | Item de proyecto para listados |

## Uso típico

```tsx
import { PageHeader } from './PageHeader';
import { Button } from './Button';
import { Card } from './Layout';

<PageHeader
  title="Proyectos"
  subtitle="Gestiona proyectos académicos, rúbricas y suites de tests"
  actions={<Button>Nuevo proyecto</Button>}
/>

<Card title="Resumen">
  Contenido del panel
</Card>
```

## Tokens de color

- Fondo app: `bg-app-bg` (`#f8fafc`)
- Superficie: `bg-white`
- Borde: `border-app-border` (`#e2e8f0`)
- Primario: `bg-primary` / `text-primary` (`#2563eb`)
- Acento institucional (vino): `bg-accent` / `text-accent` (`#5b040d`)
- Texto principal: `text-slate-900`
- Texto secundario: `text-slate-500`

## Convenciones

- Componentes en PascalCase.
- Props tipadas con TypeScript.
- Variantes controladas por props `variant`, `size`, `tone` o `status`.
- Usar `cn()` u otra utilidad para clases condicionales cuando sea necesario.
- No añadir sombras decorativas salvo en modales, overlays o popovers.
