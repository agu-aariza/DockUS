# frontend/src/shared/

Código compartido por todos los paneles y dominios del frontend: tipos, cliente HTTP, fachadas de API, gestión de estado, componentes reutilizables, utilidades y datos estáticos.

## Estructura

```
shared/
├── api/              # Cliente HTTP y fachadas tipadas
├── components/       # Componentes reutilizables
│   └── ui/           # Primitivas de UI (Button, Tabs, Layout, etc.)
├── data/             # Datos estáticos (glosario)
├── session/          # Gestión de sesiones JWT
├── toast/            # Sistema de notificaciones
├── workspace/        # Contexto de selección jerárquica
├── utils/            # Utilidades generales
└── types.ts          # Tipos de dominio compartidos con backend
```

## Capa de API

| Archivo | Función |
|---------|---------|
| [`api/http.ts`](./api/http.ts) | Cliente Axios con base URL, interceptor JWT y auto-refresh ante 401. |
| [`api/services.ts`](./api/services.ts) | Fachadas tipadas de dominio: `authApi`, `usersApi`, `projectsApi`, `assignmentsApi`, `deliveriesApi`, `storageApi`. |
| [`api/builderApi.ts`](./api/builderApi.ts) | Fachada específica del builder: runs, eventos, artefactos, chat. |

## Gestión de estado

| Archivo | Función |
|---------|---------|
| [`session/SessionContext.tsx`](./session/SessionContext.tsx) | Contexto de sesiones múltiples con persistencia en `localStorage`. |
| [`session/sessionStore.ts`](./session/sessionStore.ts) | Lectura/escritura de sesiones en `localStorage`. |
| [`session/useManagementPermissions.ts`](./session/useManagementPermissions.ts) | Helpers de permisos `canRead`/`canWrite`/`canAdmin` por rol. |
| [`workspace/WorkspaceContext.tsx`](./workspace/WorkspaceContext.tsx) | Contexto de selección jerárquica Proyecto → Asignación → Entrega → Run. |
| [`workspace/WorkspaceBar.tsx`](./workspace/WorkspaceBar.tsx) | Barra flotante de contexto con pickers. |
| [`toast/ToastContext.tsx`](./toast/ToastContext.tsx) | Sistema de notificaciones con deduplicación. |

## Componentes compartidos destacados

| Componente | Función |
|------------|---------|
| [`components/Sidebar.tsx`](./components/Sidebar.tsx) | Navegación lateral con items por rol. |
| [`components/CommandPalette.tsx`](./components/CommandPalette.tsx) | Paleta de comandos para navegación rápida. |
| [`components/ErrorBoundary.tsx`](./components/ErrorBoundary.tsx) | Captura errores de renderizado. |
| [`components/ReportView.tsx`](./components/ReportView.tsx) | Visualización de informes LLM. |
| [`components/TeacherGradingStudio.tsx`](./components/TeacherGradingStudio.tsx) | Estudio de calificación docente. |
| [`components/CodePreviewModal.tsx`](./components/CodePreviewModal.tsx) | Modal de previsualización de código. |
| [`components/TerminalViewer.tsx`](./components/TerminalViewer.tsx) | Visor de logs tipo terminal. |
| [`components/TutorChatBlock.tsx`](./components/TutorChatBlock.tsx) | Chat asistente vinculado a un run. |
| [`components/MarkdownContent.tsx`](./components/MarkdownContent.tsx) | Renderizado seguro de markdown. |
| [`components/ui/`](./components/ui/) | Primitivas UI reutilizables: `Button`, `Tabs`, `Layout`, `PageHeader`, `MetricCard`, etc. |

## Utilidades

| Archivo | Función |
|---------|---------|
| [`utils/errors.ts`](./utils/errors.ts) | Manejo y mensajes de error. |
| [`utils/format.ts`](./utils/format.ts) | Formateo de fechas, tamaños, etc. |
| [`utils/permissions.ts`](./utils/permissions.ts) | Lógica de permisos por rol. |
| [`utils/technicalFeedback.ts`](./utils/technicalFeedback.ts) | Helpers para feedback técnico de evaluaciones. |

## Datos estáticos

| Archivo | Función |
|---------|---------|
| [`data/glossary.ts`](./data/glossary.ts) | Glosario pedagógico con términos E1-E4, C1-C6, T1-T4. |
| [`types.ts`](./types.ts) | Tipos de dominio compartidos con el backend. |

## Notas

- `types.ts` debe mantenerse alineado con los DTOs del backend.
- Ningún componente de dominio debería usar Axios directamente; usar las fachadas de `api/`.
