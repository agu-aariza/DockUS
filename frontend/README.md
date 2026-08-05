# Frontend

> **Resumen rápido:** SPA en React 19 + TypeScript + Vite 8 + Tailwind CSS. La interfaz que usan profesores (gestión de proyectos, grupos, calificación) y alumnos (entrega y seguimiento en vivo de su evaluación). Habla exclusivamente con el backend por HTTP/SSE — nunca toca la base de datos, colas, MinIO o el LLM directamente.

---

## ¿Qué es esto y por qué existe?

Es la única interfaz de usuario de EduCodeAI: no hay una app separada para profesores y otra para alumnos, es una sola SPA que cambia lo que muestra según el rol de la sesión activa (`STUDENT`, `TEACHER`, `ADMIN`). El punto más importante para orientarse: **el frontend nunca habla directamente con Postgres, Redis, MinIO ni el LLM** — todo pasa por la API REST del backend (`shared/api/*` es el único sitio donde se usa `axios`) y por streams SSE para ver el progreso de una evaluación en tiempo real (`useBuilderRunStream`). Si necesitas entender qué datos existen y cómo se relacionan, el backend es la fuente de verdad — el frontend solo los consume y los presenta.

## Responsabilidades

- Panel de profesor: crear/editar proyectos y rúbricas, gestionar grupos y matrículas, revisar entregas, calificar, configurar proveedores de IA por rol.
- Panel de alumno (`student/`): subir una entrega, lanzar/seguir su evaluación en vivo, leer el informe pedagógico final.
- Autenticación y gestión de sesión (`auth/`, `shared/session/`).
- Visualización en tiempo real del pipeline del Builder (logs, estado por etapa) vía SSE.

## Qué NO hace este frontend

- **No usa Redux/Zustand ni ninguna librería de estado global externa.** El estado global se maneja con React Context API (`shared/session/`, `shared/workspace/`, `shared/theme/`, `shared/toast/`) — es una regla explícita del proyecto, no una omisión.
- **No importa `axios` fuera de `shared/api/`.** Cualquier llamada HTTP nueva se encapsula en una fachada de `shared/api/`, nunca se llama a `axios` directamente desde un componente o hook de otro directorio.
- **No usa la `EventSource` nativa del navegador para SSE** — usa `fetch` + `ReadableStream` porque necesita adjuntar la cabecera `Authorization`, algo que `EventSource` no permite.

## Estructura interna

```text
frontend/
├── src/                  # Todo el código fuente — ver src/README.md
├── public/               # Estáticos servidos tal cual (favicon, logos) — ver public/README.md
├── build/                # Salida de `vite build` (generada, gitignored) — ver build/README.md
├── test/                 # (dentro de src/, ver src/test/) setup global de Vitest + Testing Library
├── index.html            # Punto de entrada HTML de Vite
├── vite.config.ts        # outDir: 'build', plugins (React, análisis de bundle)
├── Dockerfile.frontend    # Imagen de producción (Nginx sirviendo el build estático)
└── package.json           # Scripts npm (ver abajo)
```

## Stack y decisiones clave

- **React 19 + React Router 8**, con *code splitting* explícito (`React.lazy` + `Suspense`) de cada panel principal (`TeacherHomePanel`, `StudentWorkspacePanel`, etc.) para no cargar todo el bundle en el primer render.
- **TanStack React Query** para *data fetching*: cachear, revalidar y sincronizar el estado del servidor — no se gestiona a mano con `useEffect` + `useState` para llamadas a la API.
- **Tailwind CSS** para estilos; `shared/components/ui/` es la capa de diseño puro (sin lógica de negocio ni API).
- **`@educodeai/contracts`**: tipos compartidos con el backend (`file:../shared/contracts`), la fuente única de verdad para las formas de datos que cruzan la red.

## Cómo trabajar aquí

```bash
npm install
npm run dev          # servidor Vite en :5173
npm run build          # tsc -b && vite build → build/
npm run typecheck        # tsc -b, sin compilar
npm run lint               # ESLint sobre src/
npm test                     # Vitest (*.spec.tsx / *.spec.ts)
npm run coverage                # vitest run --coverage
```

La forma recomendada de levantar el stack completo (frontend + backend + infraestructura) es `docker compose --profile dev up --build` desde la raíz del repo.

## Ver también

- [`src/README.md`](src/README.md) — organización del código fuente.
- Raíz del repo: [`../README.md`](../README.md) y [`../ARCHITECTURE.md`](../ARCHITECTURE.md) para la visión de sistema completa (incluye el backend).
- [`../backend/README.md`](../backend/README.md) — la API que este frontend consume.
