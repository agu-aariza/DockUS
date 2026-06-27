# frontend/src/

Código fuente de la SPA React. Aquí viven los paneles por rol, los componentes compartidos, la capa de API, la gestión de estado y los estilos.

## Estructura

```
src/
├── main.tsx              # Punto de entrada: monta React y los providers globales
├── App.tsx               # Router principal, layout global, sidebar, workspace bar
├── styles.css            # Tailwind directives + componentes CSS custom
├── env.d.ts              # Tipos de Vite client
├── auth/                 # Panel de autenticación
├── builder/              # Visualización del pipeline builder
├── deliveries/           # Panel de entregas y calificación
├── groups/               # Gestión de grupos académicos
├── projects/             # Gestión de proyectos docente
├── summary/              # Dashboard de inicio docente
├── runtime/              # Panel de ejecución en tiempo real
├── shared/               # Componentes, API, estado y utilidades compartidas
├── storage/              # Panel de almacenamiento de artefactos
├── student/              # Espacio personal del alumno
└── users/                # Administración de usuarios
```

## Archivos más importantes

| Archivo | Función |
|---------|---------|
| [`main.tsx`](./main.tsx) | Monta la aplicación con `BrowserRouter`, `SessionProvider`, `ToastProvider`, `WorkspaceProvider` y `ErrorBoundary`. |
| [`App.tsx`](./App.tsx) | Define las rutas, el layout global, la sidebar, la workspace bar, la command palette y el debug switcher (dev). |
| [`styles.css`](./styles.css) | Directivas de Tailwind, utilidades y componentes CSS (`btn-primary`, `input-field`, `card`, etc.). |
| [`shared/types.ts`](./shared/types.ts) | Tipos de dominio compartidos con el backend (~700 líneas). |

## Convenciones

- Cada carpeta de dominio (`projects/`, `student/`, `builder/`, etc.) puede tener sus propios `components/`, `hooks/` y `utils/`.
- `shared/` contiene código reutilizable por todos los dominios.
- Los paneles principales se cargan con `React.lazy()` para aprovechar el code splitting de Vite.
