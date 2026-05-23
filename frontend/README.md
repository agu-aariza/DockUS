# DockUS — Frontend

SPA (Single Page Application) construida con React 18 y Vite 5. Ofrece dos experiencias diferenciadas: una consola de trabajo para profesorado y administración, y un espacio personal para el alumnado con seguimiento en tiempo real del pipeline de evaluación.

## Stack

| Tecnología | Rol |
|-----------|-----|
| React 18 + TypeScript 5.6 | UI y tipado |
| Vite 5.4 | Bundler, HMR, code splitting |
| React Router DOM 7 | Navegación client-side |
| Axios 1.8 | Cliente HTTP con interceptores |
| Tailwind CSS 3.4 | Estilos utility-first |
| React Markdown 10 | Renderizado de informes LLM |

## Rutas

### Alumno

| Ruta | Panel |
|------|-------|
| `/mi-espacio` | Espacio personal: asignaciones, entregas, envío de código e informes |

### Profesor / Administrador

| Ruta | Panel |
|------|-------|
| `/resumen` | Dashboard con métricas de cohorte |
| `/projects` | Gestión de proyectos, asignaciones y suite docente |
| `/deliveries` | Revisión de entregas, calificación asistida por IA e informes |
| `/runtime` | Lanzamiento y seguimiento del pipeline builder en tiempo real |
| `/groups` | Gestión de grupos de curso y matrículas |
| `/users` | Administración de usuarios *(solo ADMIN)* |
| `/storage` | Inspección de objetos almacenados *(solo ADMIN)* |

La ruta `/` es el login. Sin sesión activa, el acceso a cualquier ruta autenticada redirige a `/`.

## Gestión de estado

El frontend usa **Context API + hooks personalizados**, sin Redux ni Zustand:

| Contexto | Responsabilidad |
|---------|----------------|
| `SessionContext` | Sesiones múltiples, tokens JWT, auto-refresh de access token |
| `WorkspaceContext` | Selección jerárquica Proyecto → Asignación → Entrega → Run |
| `ToastContext` | Cola de notificaciones con deduplicación por fingerprint |

### Modelo de sesión

La aplicación admite varias sesiones abiertas en paralelo dentro del mismo navegador (útil para validar distintos roles sin reiniciar):

- Persistencia en `localStorage`.
- Selección de sesión activa en cualquier momento.
- El interceptor de Axios renueva el `accessToken` automáticamente ante respuestas `401`, encolando las peticiones concurrentes hasta completar el refresco.

## Capa de API

Ningún componente llama a Axios directamente. Todas las peticiones pasan por fachadas tipadas:

| Fachada | Endpoints cubiertos |
|--------|-------------------|
| `authApi` | `/auth/*` — login, registro, refresh |
| `usersApi` | `/users/*` — CRUD y gestión de estado |
| `projectsApi` | `/projects/*` — proyectos, runtime, insights |
| `assignmentsApi` | `/assignments/*` — asignaciones individuales y bulk |
| `deliveriesApi` | `/deliveries/*` — entregas, preview de código, calificación |
| `builderApi` | `/builder/*` — runs, eventos, artefactos, cancelación |

Configuración del cliente HTTP: `src/shared/api/http.ts`  
Fachadas de dominio: `src/shared/api/services.ts` y `src/shared/api/builderApi.ts`

### Variable de entorno

```bash
VITE_API_BASE_URL=http://localhost:3000/api   # valor por defecto
```

## Streaming de eventos en tiempo real

El hook `useBuilderRunStream` sigue el progreso de un `BuildRun` con dos modos de transporte:

1. **SSE (primario)** — `EventSource` sobre `/api/builder/runs/{id}/stream`
2. **Polling (fallback)** — cada 3 segundos si el stream se interrumpe

Los eventos se dedupliclan por `id` y se ordenan por `sequence` antes de renderizarse en el timeline. Los estudiantes ven el progreso mapeado a etapas pedagógicas (`building`, `executing`, `evaluating`, `completed`…).

## Estructura del código

```
frontend/src/
├── shared/
│   ├── api/             # Cliente HTTP y fachadas de API
│   ├── session/         # SessionContext, sessionStore
│   ├── workspace/       # WorkspaceContext
│   ├── toast/           # ToastContext
│   ├── components/      # Componentes reutilizables y primitivas UI
│   ├── data/            # Glosario pedagógico (E1-E4, C1-C6, T1-T4)
│   └── types.ts         # Tipos de dominio compartidos con el backend
├── builder/
│   ├── components/      # BuilderLiveRunPane (timeline + consola + artefactos)
│   └── hooks/           # useBuilderRunStream
├── projects/            # Panel de gestión de proyectos
├── deliveries/          # Panel de entregas y calificación
├── runtime/             # Panel de ejecución (TeacherRuntimePanel)
├── student/             # Espacio del alumno, hooks y validación de entregas
├── App.tsx              # Router principal + layout
└── main.tsx             # Entry point
```

## Desarrollo local

### Requisitos

- Node.js 22, npm 10+
- Backend de DockUS accesible en `VITE_API_BASE_URL`

### Comandos

```bash
# Instalar dependencias
npm install

# Servidor de desarrollo (puerto 5173)
npm run dev

# Build de producción (typecheck + bundle)
npm run build

# Preview de la build generada
npm run preview

# Comprobación de tipos sin generar ficheros
npm run typecheck

# Linting
npm run lint
```

Lo más cómodo para un entorno completo es ejecutar el `docker compose` de la raíz del repositorio.

## Convenciones

- Los tipos en `src/shared/types.ts` deben mantenerse alineados con los DTOs del backend. Cuando cambie un contrato de API, revisar a la vez los tipos, la fachada correspondiente y los componentes consumidores.
- La validación principal es la propia build de TypeScript + Vite. No hay suite de tests de componentes todavía.
- La aplicación está optimizada para escritorio (≥ 1280 px). El layout es responsivo con sidebar en drawer en móvil.
