# Sistema de diseño (`shared/components/ui/`)

> **Resumen rápido:** La capa de componentes puramente presentacionales — sin `import` de `api/`, sin conocimiento de ningún dominio de negocio. Doce componentes: layout de la aplicación, átomos de interacción y utilidades visuales.

---

## La regla que define esta carpeta

Es explícita en `CLAUDE.md`: **`shared/components/ui/` son componentes dumb, agnósticos de negocio/API — ningún import de `api/` ni lógica de dominio aquí.** Un componente de esta carpeta recibe todo lo que necesita por props; si necesita pedir datos o conocer qué es un `Project`, no pertenece a `ui/` — pertenece a la raíz de `shared/components/` o a un dominio concreto.

## Los trece componentes

| Componente | Qué es |
| --- | --- |
| `AppShell.tsx` | El marco de la aplicación: navegación, header, slot de contenido. |
| `Layout.tsx` | Estructura de página genérica dentro del shell. |
| `PageHeader.tsx` | Cabecera estándar de página (título, acciones). |
| `Button.tsx` | Botón con variantes y estado de carga. |
| `Alert.tsx` | Aviso en línea (info/éxito/advertencia/error). |
| `StatusBadge.tsx` | Insignia de estado con `StatusTone` — la base que reutilizan `report/`, `users/userConstants.ts`, `ProjectStatusBadge`, etc. |
| `DataTable.tsx` | Tabla genérica con ordenación/paginación — la base de `GradebookTable`, `UsersPanel`, `StoragePanel`. |
| `Tabs.tsx` | Navegación por pestañas genérica. |
| `SearchInput.tsx` | Campo de búsqueda con debounce. |
| `StatsOverview.tsx` | Fila de estadísticas resumidas. |
| `VisualPicker.tsx` | Selector visual (tarjetas seleccionables), usado en flujos de configuración. |
| `LogoPlate.tsx` | Placa que normaliza logos heterogéneos (con/sin canal alfa) según el tema — ver el detalle completo en [`../../../landing/README.md`](../../../landing/README.md), que es donde nació. |

## Cómo trabajar aquí

```bash
npm run test -- src/shared/components/ui
```

Si un componente de aquí empieza a necesitar `useQuery`/`axios` o a importar un tipo de `features/<dominio>/`, es una señal de que ha dejado de ser "dumb" — muévelo a la raíz de `shared/components/` o al dominio correspondiente en vez de romper la regla en el sitio.

## Ver también

- [`../README.md`](../README.md) — la diferencia entre esta carpeta y la raíz de `shared/components/`.
