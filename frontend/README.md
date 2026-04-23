# DockUS Frontend

El frontend de DockUS es una consola React/Vite orientada a operación académica. No está planteado hoy como un portal de marketing ni como una aplicación pública generalista, sino como una superficie de trabajo para profesorado, administración y alumnado autenticado.

## Objetivo del frontend

La aplicación prioriza tres tareas:

- navegar el dominio académico sin depender de UUIDs manuales;
- lanzar y revisar runs del builder desde una experiencia guiada;
- mantener herramientas técnicas auxiliares visibles para soporte y depuración.

## Stack

| Área | Tecnología |
| --- | --- |
| UI | React 18 |
| Bundler | Vite 5 |
| Routing | `react-router-dom` |
| Cliente HTTP | `axios` |
| Lenguaje | TypeScript |

## Rutas actuales

La shell principal vive en [`src/App.tsx`](./src/App.tsx) y expone estas rutas:

| Ruta | Propósito |
| --- | --- |
| `/auth` | Registro, login y cambio de sesión activa. |
| `/projects` | Gestión de proyectos, asignaciones y suite docente. |
| `/deliveries` | Flujo guiado de entregas e informe final. |
| `/builder` | Historial, lanzamiento y seguimiento técnico de runs. |
| `/users` | Herramienta operativa para administración de usuarios. |
| `/storage` | Herramienta avanzada para inspección y subida de artefactos. |

Si no hay sesión activa, la navegación queda bloqueada para módulos autenticados y el usuario es redirigido a `/auth`.

## Modelo de sesión

La aplicación soporta varias sesiones abiertas en paralelo dentro del navegador.

Características:

- persistencia de sesiones en cliente;
- selección explícita de sesión activa;
- cierre individual o masivo de sesiones;
- aviso centralizado si el backend responde `401` o `403`.

Esto es útil para validar distintos roles (`ADMIN`, `TEACHER`, `STUDENT`) sin reiniciar la app.

## Experiencia funcional actual

### Proyectos

El panel de proyectos permite:

- listar proyectos;
- crear y editar metadatos;
- cambiar estado funcional;
- asignar estudiantes;
- consultar progreso agregado;
- subir o reemplazar la suite docente.

### Entregas

El panel de entregas ofrece una ruta guiada:

- proyecto -> asignación -> entrega;
- creación y edición de entregas;
- cambio de estado;
- restauración y borrado lógico;
- carga del informe final del último run disponible.

### Builder

El panel builder está pensado como superficie técnica:

- selección guiada de proyecto, asignación y entrega;
- lanzamiento de runs;
- cancelación de runs activos;
- histórico paginado por entrega;
- timeline de eventos del run;
- visualización del detalle persistido del run.

### Herramientas avanzadas

- `Users`: administración y consulta de usuarios.
- `Storage`: acceso operativo a objetos almacenados.
- `JsonResult`: panel de depuración para ver payloads sin abstraerlos.

## Integración con la API

### Base URL

La aplicación usa:

- `VITE_API_BASE_URL`

Por defecto apunta a:

- `http://localhost:3000/api`

La configuración del cliente está en [`src/shared/api/http.ts`](./src/shared/api/http.ts).

### Autenticación

El token JWT se inyecta en cada petición mediante interceptor de Axios.

Comportamiento relevante:

- si la API devuelve `401` o `403`, el cliente emite una advertencia global de autenticación;
- la UI no intenta refrescar tokens automáticamente;
- la sesión activa se controla desde la shell principal.

### Builder y eventos

El frontend consume:

- detalle de runs;
- listado de runs por entrega;
- backlog incremental de eventos.

El hook [`src/builder/hooks/useBuilderRunStream.ts`](./src/builder/hooks/useBuilderRunStream.ts):

- intenta abrir un stream SSE si el backend lo ofrece;
- si no está disponible, cae a polling incremental sobre eventos.

Eso permite mantener la UI funcional incluso cuando el backend sólo soporta el contrato de eventos paginados.

## Estructura del código

```text
frontend/
├── src/
│   ├── auth/
│   ├── builder/
│   │   ├── components/
│   │   └── hooks/
│   ├── deliveries/
│   ├── projects/
│   ├── shared/
│   │   ├── api/
│   │   ├── components/
│   │   ├── session/
│   │   └── utils/
│   ├── storage/
│   ├── users/
│   ├── App.tsx
│   └── main.tsx
└── package.json
```

## Directorios más importantes

### `src/shared/`

Contiene la base transversal del frontend:

- tipos compartidos con el backend;
- cliente HTTP;
- gestión de sesión;
- utilidades de errores y permisos;
- componentes reutilizables.

### `src/projects/`

Panel de gestión de proyectos y tablero de progreso.

### `src/deliveries/`

Flujo guiado de entregas e informe final.

### `src/builder/`

Superficie técnica del builder:

- control de runs,
- tabla de histórico,
- timeline en vivo,
- hooks de eventos.

## Desarrollo local

### Instalar dependencias

```bash
cd frontend
npm install
```

### Ejecutar en desarrollo

```bash
npm run dev
```

### Construcción de producción

```bash
npm run build
```

### Preview local

```bash
npm run preview
```

## Scripts disponibles

| Script | Propósito |
| --- | --- |
| `npm run dev` | Arranca Vite en desarrollo. |
| `npm run build` | Ejecuta `tsc -b` y luego `vite build`. |
| `npm run preview` | Sirve localmente la build generada. |

## Requisitos

- Node.js 22
- npm 10+
- backend de DockUS accesible

Para un entorno completo, lo más cómodo es ejecutar el `docker compose` de la raíz del repositorio.

## Convenciones operativas

- La aplicación usa TypeScript estricto suficiente para el uso actual, pero no hay un sistema de tests frontend todavía.
- La validación principal del frontend hoy es la build de Vite/TypeScript.
- Los tipos del builder en [`src/shared/types.ts`](./src/shared/types.ts) deben mantenerse alineados con los DTOs del backend.
- Cuando cambien contratos de API, revisa a la vez:
  - `src/shared/types.ts`,
  - `src/shared/api/`,
  - componentes que consumen el módulo afectado.

## Estado actual y límites

- El frontend está optimizado para escritorio y operación técnica interna.
- La navegación actual sigue siendo una consola de trabajo; no pretende ocultar toda la complejidad del backend.
- Algunas pantallas exponen payloads JSON de depuración a propósito para acelerar validación funcional.
- La ruta `/builder` sigue siendo el centro técnico del seguimiento de runs; `Entregas` consume el informe final y no duplica toda la telemetría.

## Relación con el backend

El frontend depende especialmente de estos contratos:

- `/api/auth/*`
- `/api/projects/*`
- `/api/deliveries/*`
- `/api/storage/*`
- `/api/builder/*`
- `/api/users/*`
- `/api/health/*`

Swagger del backend:

- [http://localhost:3000/api/docs](http://localhost:3000/api/docs)

## Recomendación de trabajo

Si vas a tocar esta app de forma seria:

1. arranca primero backend y frontend;
2. valida el flujo con al menos un usuario `TEACHER` y uno `STUDENT`;
3. confirma la build final con `npm run build`;
4. si cambias contratos del builder, verifica también el panel de entregas y el panel builder.
