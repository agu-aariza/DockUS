# Código fuente del frontend (`src/`)

> **Resumen rápido:** Todo el TypeScript/React de la aplicación. Se organiza por dominio de negocio (`auth/`, `builder/`, `student/`...) más una capa transversal (`shared/`) y una capa de tipos puros (`features/`) que replica las formas de datos del backend sin lógica ni UI.

---

## Cómo orientarte aquí

Cada carpeta al mismo nivel que `App.tsx` es, o bien un dominio de negocio con sus propios componentes/hooks/páginas, o bien una de las tres capas transversales (`shared/`, `features/`, `test/`). La convención de nombres es la misma en casi todos los dominios: un `<Dominio>Panel.tsx` como página principal, `components/` para piezas específicas de ese dominio, `hooks/` para su lógica con estado.

## Estructura interna

```text
src/
├── App.tsx              # Enrutamiento raíz (React Router), selecciona vistas según AuthenticatedUser.role
├── main.tsx              # Punto de entrada de ReactDOM
├── styles.css              # Import de Tailwind + estilos/animaciones globales
├── env.d.ts / global.d.ts    # Tipos de entorno Vite y globales del proyecto
│
├── auth/                 # Login UI + DebugSwitcher (dev tool) — ver auth/README.md
├── landing/               # Página pública antes de iniciar sesión — ver landing/README.md
├── student/                # Todo el flujo del alumno: workspace, entrega, seguimiento — ver student/README.md
├── student-profile/         # Expediente/timeline de un alumno — ver student-profile/README.md
├── projects/                 # Panel docente de proyectos y rúbricas — ver projects/README.md
├── deliveries/                 # Panel docente de entregas y calificación — ver deliveries/README.md
├── reporting/                 # Componentes de informes Builder compartidos por las vistas — ver reporting/README.md
├── groups/                      # Gestión de grupos académicos — ver groups/README.md
├── builder/                       # Visualización en vivo del pipeline del Builder — ver builder/README.md
├── runtime/                         # Inspección de entornos/runtimes Docker — ver runtime/README.md
├── llm/                               # Configuración de proveedores de IA por rol — ver llm/README.md
├── storage/                            # Panel de objetos almacenados (admin) — ver storage/README.md
├── summary/                              # Dashboards/analíticas del cohorte — ver summary/README.md
├── users/                                  # Administración de usuarios (admin) — ver users/README.md
│
├── features/                # Tipos/DTOs puros por dominio, espejo del backend — ver features/README.md
├── shared/                    # Capa transversal: API, sesión, UI, tema, toasts... — ver shared/README.md
├── app/                       # Composición global de la aplicación y navegación de workspace
└── test/                        # Setup global de Vitest + Testing Library — ver test/README.md
```

## La regla de capas: `features/` vs. dominio vs. `shared/`

```text
features/<dominio>/    → SOLO tipos/DTOs/constantes. Sin React, sin llamadas a API, sin UI.
<dominio>/               → Componentes, hooks y páginas de ESE dominio. Puede importar de features/ y shared/.
reporting/                  → UI y utilidades de informes Builder. Puede importar tipos/API del Builder y piezas transversales.
shared/                     → Cross-cutting: API, sesión, workspace, toasts, design system. No conoce ningún dominio.
```

Un componente de `projects/` puede importar tipos de `features/projects/` y utilidades de `shared/`, pero `shared/` nunca importa de `projects/` ni de ningún otro dominio — misma regla de dependencia unidireccional que en el backend (`shared/` ↛ `modules/`).

## `App.tsx`: cómo se decide qué panel se muestra

`App.tsx` enruta con React Router 8 y decide el conjunto de rutas disponibles según `AuthenticatedUser.role` (resuelto por `useSession()`). Cada panel principal se carga con `React.lazy` + `Suspense` (*code splitting* explícito) — al añadir un panel nuevo, sigue ese mismo patrón en vez de importarlo de forma estática, para no inflar el bundle inicial que descarga cualquier usuario antes de iniciar sesión.

## Cómo trabajar aquí

```bash
npm run build       # tsc -b && vite build
npm run typecheck     # tsc -b, sin compilar
```

## Ver también

- [`shared/README.md`](shared/README.md) — la capa transversal, léela pronto si vas a tocar varios dominios.
- [`features/README.md`](features/README.md) — de dónde salen los tipos que usa cada dominio.
- [`../README.md`](../README.md) — visión general del frontend.
