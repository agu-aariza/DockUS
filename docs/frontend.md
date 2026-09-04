# Frontend

## Responsabilidad

El frontend es una SPA en React 19, TypeScript, Vite y Tailwind CSS. Es la interfaz única para alumnos, docentes y administradores: las rutas y los paneles disponibles dependen del rol de la sesión activa.

El navegador solo habla con la API por HTTP y SSE. Nunca accede directamente a PostgreSQL, Redis, MinIO, Docker o un proveedor LLM.

## Arranque y composición

[main.tsx](../frontend/src/main.tsx) compone los providers globales en este orden funcional:

```text
QueryClientProvider
└── BrowserRouter
    └── ThemeProvider
        └── SessionProvider
            └── ToastProvider
                └── WorkspaceProvider
                    └── ErrorBoundary
                        └── App
```

`App.tsx` protege las rutas privadas, hace code splitting con `React.lazy`/`Suspense` y decide el panel por rol:

| Rol | Superficie principal |
| --- | --- |
| `STUDENT` | `/mi-espacio`: asignaciones, entrega, seguimiento y reporte |
| `TEACHER` | `/summary`, `/projects`, `/deliveries`, `/groups`, `/students/:studentId`, `/runtime`, `/storage` |
| `ADMIN` | las rutas docentes más `/users` y `/llm` |

La ruta `/` es la landing pública y `/acceso` el login/registro. Una sesión autenticada se redirige al workspace correspondiente.

## Capas de código

```text
src/<dominio>/       componentes, páginas y hooks del dominio
src/features/        tipos y DTOs puros por dominio
src/shared/          HTTP, sesión, query cache, workspace, UI, tema y toasts
src/app/             composición de navegación y workspace
src/reporting/       vistas comunes del informe Builder v3
```

Los dominios principales son `auth`, `student`, `projects`, `deliveries`, `groups`, `builder`, `reporting`, `runtime`, `llm`, `storage`, `summary` y `users`. `shared/` no debe importar lógica de un dominio concreto. `features/` no contiene React, hooks ni llamadas de API.

## Transporte HTTP y sesión

[shared/api/http.ts](../frontend/src/shared/api/http.ts) es la única instancia de Axios. Hace cuatro tareas importantes:

- usa `VITE_API_BASE_URL` y el prefijo `/api`;
- añade `Authorization: Bearer` con el access token de la sesión activa;
- renueva tokens caducados por `/auth/refresh` y encola peticiones concurrentes durante un refresh;
- normaliza errores para que componentes y React Query reciban una forma estable.

`SessionContext` mantiene sesiones múltiples, sincroniza la sesión activa con el cliente HTTP y persiste el registro sanitizado en `localStorage`: el access token no se persiste, mientras que el refresh token se conserva para rehidratar la sesión. Este diseño debe revisarse junto con el modelo de amenazas antes de usar el frontend en un entorno público.

## Datos de servidor

TanStack React Query es la capa de fetching y caché:

- queries: `staleTime` de 30 segundos, garbage collection de 5 minutos y reintento limitado;
- errores 4xx: no se reintentan;
- mutaciones: no se reintentan automáticamente para evitar dobles entregas o cambios;
- `queryKeys` agrupa cachés por dominio y permite invalidar después de crear una entrega o un run.

Los tipos que cruzan la red se importan desde [shared/contracts](../shared/contracts/index.ts) o desde `frontend/src/features` cuando se necesita una forma específica de la UI.

## Flujo de entrega del alumno

`useSubmissionFlow` coordina el asistente de entrega:

1. Selecciona una asignación y valida ventanas, entregas restantes y preview del archivo.
2. Crea la entrega mediante `deliveriesApi`.
3. Calcula SHA-256 y sube el archivo mediante `storageApi`.
4. Lanza el Builder mediante `builderApi.runForDelivery`.
5. Refresca el workspace y muestra el `buildRunId` para seguir el procesamiento.

La lógica de negocio del resultado sigue siendo del backend; el hook solo coordina estado de interacción y datos de servidor.

## Streaming del Builder

El navegador no usa `EventSource` porque necesita adjuntar el JWT. [useBuilderRunStream.ts](../frontend/src/builder/hooks/useBuilderRunStream.ts) usa `fetch` y `ReadableStream`:

1. pide el backlog REST con `afterSequence`;
2. abre `/api/builder/runs/:id/stream?afterSequence=...`;
3. parsea frames SSE `ready` y `run-event`;
4. fusiona eventos por id/secuencia en un reducer;
5. aplica backoff y reconecta si el stream termina;
6. deja el estado en `terminal` al recibir `RUN_COMPLETED`, `RUN_FAILED` o `RUN_CANCELLED`.

Así la UI tolera una desconexión sin perder el historial que ya está en PostgreSQL. La vista en vivo separa metadata, estado, timeline, consola, evidencias, assessment y chat.

## Informes

`ReportView` carga el informe v3 desde la API y selecciona la proyección según `audience`:

- alumno: nota oficial/provisional, evidencias, logros, brechas, próximos pasos y detalles técnicos avanzados colapsables;
- docente: propuesta de IA, decisión académica, confianza, hallazgos, flags de revisión y preview exacto del alumno.

La exportación también la hace la API; el frontend no reconstruye ni recalcula el informe.

## Cómo extender la interfaz

1. Añadir el tipo o contrato en `features/`/`shared/contracts`.
2. Encapsular HTTP en `src/<dominio>/api` usando `http`, nunca Axios directamente desde un componente.
3. Usar React Query para datos del servidor y Context solo para estado transversal.
4. Mantener la autorización en backend; ocultar una ruta en React no es un control de seguridad.
5. Añadir estados explícitos de carga, error, vacío y terminal.
6. Añadir test de hook/componente y actualizar los query keys si cambia la invalidación.

## Comandos

Desde `frontend/`:

```bash
npm install
npm run dev
npm run typecheck
npm run lint
npm run build
npm test
npm run coverage
```

Consulta [frontend-assets.md](frontend-assets.md) para los ficheros estáticos y [testing.md](testing.md) para el orden de verificación.

