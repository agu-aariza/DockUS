# Workspace (`shared/workspace/`)

> **Resumen rápido:** El contexto de "en qué proyecto/entrega estoy trabajando ahora mismo", separado deliberadamente en dos contextos independientes (selección vs. estado de UI) y compuestos por un tercero. Evita el prop-drilling de "proyecto actual" a través de paneles profundamente anidados — regla explícita del proyecto: usar `useWorkspaceSelection()`, nunca pasar el proyecto activo como prop de componente en componente.

---

## Por qué son tres ficheros y no uno

```text
WorkspaceSelectionContext.tsx   → QUÉ está seleccionado: proyecto/entrega/grupo activos. useWorkspaceSelection()
WorkspaceUIContext.tsx            → CÓMO se muestra: estado de UI del workspace (paneles abiertos, modo compacto...)
WorkspaceContext.tsx                → Compone los dos anteriores en un único Provider para envolver la app
```

Separar "qué está seleccionado" de "cómo se está mostrando" permite que un componente que solo necesita saber el proyecto activo (`useWorkspaceSelection()`) no se re-renderice cuando cambia un detalle de UI que no le afecta, y viceversa — son dos ejes de cambio independientes con frecuencias de actualización distintas.

## `WorkspaceBar.tsx`

El único componente visual de esta carpeta: la barra contextual que deja cambiar de proyecto/entrega sin salir del panel actual. Consume `useWorkspaceSelection()` para leer y cambiar la selección activa.

## Estructura interna

```text
workspace/
├── WorkspaceContext.tsx            # Provider compuesto (Selection + UI), el que se monta en App.tsx
├── WorkspaceSelectionContext.tsx     # useWorkspaceSelection() — proyecto/entrega/grupo activos
├── WorkspaceUIContext.tsx              # Estado de presentación del workspace
└── WorkspaceBar.tsx                       # La barra de navegación contextual
```

## Cómo trabajar aquí

```bash
npm run test -- src/shared/workspace
```

Si necesitas que un componente sepa "qué proyecto está activo", usa `useWorkspaceSelection()` — no lo subas como prop desde `App.tsx` a través de varios niveles de componentes intermedios que no lo necesitan.

## Ver también

- [`../README.md`](../README.md) — los cuatro contextos globales de la aplicación.
