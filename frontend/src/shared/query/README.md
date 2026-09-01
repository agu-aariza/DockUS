# React Query — configuración compartida (`shared/query/`)

> **Resumen rápido:** Las tres piezas que hacen que React Query funcione igual en toda la app: la configuración por defecto (`queryClient.ts`), la factoría central de claves de caché (`queryKeys.ts` — con más matices de los que parece a simple vista), y las devtools condicionadas a desarrollo.

---

## `queryClient.ts`: las reglas por defecto de toda petición

```typescript
staleTime: 30_000        // reentrar a una pantalla dentro de 30s reutiliza caché: cero red, cero parpadeo
gcTime: 5 * 60_000       // datos no usados se descartan de memoria a los 5 minutos
retry: (n, error) => !isClientError(error) && n < 2   // nunca reintenta un 4xx — no tiene sentido
refetchOnWindowFocus: true
refetchOnReconnect: true

mutations.retry: 0       // un create/update/delete NUNCA se reintenta solo — riesgo de doble envío
```

Dos decisiones que no son obvias a simple vista:

- **No usa `axios.isAxiosError` para distinguir errores de cliente.** `http.ts` (`shared/api/`) ya normaliza cualquier error a `ApiErrorPayload` antes de que React Query lo vea — así que `isClientError` solo mira `statusCode`, sin acoplarse a la forma interna de axios.
- **Las mutaciones nunca reintentan automáticamente**, a diferencia de las queries de lectura. Reintentar un `POST /deliveries` fallido por su cuenta podría crear la entrega dos veces si el primer intento sí llegó al servidor pero la respuesta se perdió — un riesgo que no existe al releer datos.

## `queryKeys.ts`: por qué existe una factoría central en vez de claves sueltas por hook

Sin una factoría única, sería fácil que dos hooks distintos pidieran "los proyectos" con claves de caché ligeramente distintas (`['projects']` vs `['projects', 'list']`) y acabaran sin compartir caché entre sí sin darse cuenta, o peor: que dos consultas con **parámetros distintos** compartieran la misma clave y una pisara los datos de la otra en caché. `queryKeys.ts` es la única fuente de claves de todo el frontend, organizada por dominio (`projects`, `deliveries`, `assignments`, `groups`, `users`, `storage`, `llmConfig`, `studentProfile`, `builderChat`, `builderRuns`, `health`, `commandPalette`, `runtime`, `workspaceBar`, `summary`).

El patrón que se repite en casi todas las entradas, y que vale la pena entender antes de añadir una clave nueva: **si dos llamadas al mismo endpoint usan parámetros distintos (paginación, límite, orden), necesitan claves distintas**, aunque parezcan "la misma query". El propio fichero documenta varios casos reales de esto:

- `projects.picker()` (lista ligera para selectores rápidos, compartida por `WorkspaceBar` y `CommandPalette`) es una clave **distinta** de `projects.list()` (con orden/paginación) y de `storage.projectsFilter()` (`limit: 100`) — las tres piden "proyectos" pero con formas de respuesta y parámetros distintos, así que comparten endpoint pero no caché.
- `deliveries.mine()` es distinta de `deliveries.list(assignmentId)`: la primera es la vista del propio alumno (el backend ya filtra por el usuario autenticado), la segunda siempre exige una asignación — nunca se puede derivar una de la otra.
- `projects.progressSummary(projectId, groupId)` normaliza `groupId` ausente a `null` explícitamente, para que "sin filtro de grupo" sea **la misma entrada de caché** la pida quien la pida (`CohortAnalyticsDashboard` sin `groupId`, `ProgressDashboard` con `groupId` opcional) — sin esa normalización, `undefined` y `null` producirían dos entradas de caché distintas para exactamente la misma petición.

Antes de añadir una clave nueva, comprueba si de verdad es una consulta distinta a las que ya existen para ese dominio (parámetros, paginación) — si lo es, dale su propia entrada con un comentario explicando por qué, siguiendo el estilo del resto del fichero; si no lo es, reutiliza la que ya existe en vez de crear una tercera variante silenciosa.

## `QueryDevtools.tsx`: por qué no es un simple `{import.meta.env.DEV && <Devtools/>}`

Un `import` estático de `@tanstack/react-query-devtools` viajaría en el bundle de producción aunque el componente nunca se renderizara — Rollup no puede eliminar un módulo que sí se importa, solo código muerto dentro de uno ya importado. `QueryDevtools.tsx` en cambio usa `import.meta.env.DEV` (que Vite reemplaza estáticamente por `false` en build de producción) para decidir en tiempo de build si el `import()` dinámico existe siquiera — así Rollup elimina la rama completa, y con ella el chunk entero de devtools, del bundle final.

## Estructura interna

```text
query/
├── queryClient.ts      # createQueryClient() + queryDefaultOptions
├── queryKeys.ts           # La factoría central de claves — ver arriba
└── QueryDevtools.tsx        # Devtools, solo en desarrollo, con tree-shaking real
```

## Cómo trabajar aquí

```bash
npm run test -- test/unit/shared/query
```

Cualquier hook nuevo que use `useQuery`/`useMutation` debe tomar su clave de `queryKeys`, nunca declarar un array de clave inline en el propio hook — es la única forma de que la invalidación de caché (`queryClient.invalidateQueries(...)`) funcione de forma predecible entre hooks distintos que consultan el mismo dato.

## Ver también

- [`../api/README.md`](../api/README.md) — las fachadas que estas queries invocan como `queryFn`.
- [`../README.md`](../README.md) — la capa transversal del frontend en conjunto.
