# Cliente API (`shared/api/`)

> **Resumen rápido:** El único lugar del frontend donde se usa `axios`. Un fichero de fachada por dominio del backend (`projectsApi.ts`, `deliveriesApi.ts`, etc.), todos construidos sobre la misma instancia configurada en `http.ts`. `services.ts` es solo un punto de reexportación de compatibilidad.

---

## Por qué está partido en un fichero por dominio

Antes existía como un único agregado grande; ahora cada `*Api.ts` vive cerca del dominio al que sirve, para mantener los contratos pequeños y el fichero manejable. `services.ts` reexporta todos (`export { authApi } from "./authApi";` ...) — sigue existiendo como fachada de compatibilidad para no romper imports antiguos, pero un componente nuevo puede importar directamente `./projectsApi` si lo prefiere.

## Estructura interna

```text
api/
├── http.ts               # La instancia axios: interceptores de token JWT, manejo global de 401/403
├── query-params.ts         # Serialización consistente de query params (paginación, filtros) entre todas las *Api
├── services.ts                # Reexporta todas las *Api — fachada de compatibilidad
├── authApi.ts                   # /auth/*
├── usersApi.ts                    # /users/*
├── groupsApi.ts                     # /groups/*
├── projectsApi.ts                     # /projects/*
├── assignmentsApi.ts                    # /projects/:id/assignments/*, /assignments/*
├── deliveriesApi.ts                       # /deliveries/*
├── storageApi.ts                            # /storage/*
├── builderApi.ts                              # /builder/* (incluye el endpoint SSE, consumido aparte por useBuilderRunStream)
├── llmApi.ts                                    # /builder/llm-configs/*
├── studentsApi.ts                                 # /students/*
└── healthApi.ts                                     # /health/*
```

## `http.ts`: qué pasa en cada petición

Cada petición sale con el token JWT de la sesión activa inyectado por un interceptor (leído de `shared/session/`). Un interceptor de respuesta trata globalmente los `401`/`403` — no cada componente decide individualmente qué hacer cuando el token expira. El *stream* SSE del Builder (`GET /builder/runs/:id/stream`) **no** pasa por esta instancia de axios: usa `fetch` + `ReadableStream` directamente en `builder/hooks/useBuilderRunStream.ts`, porque necesita la cabecera `Authorization` en una conexión de streaming que `EventSource` no soporta.

## Cómo trabajar aquí

```bash
npm run test -- src/shared/api
```

Si añades un endpoint nuevo, añade el método en el `*Api.ts` del dominio correspondiente (créalo si el dominio es nuevo) — nunca llames a `axios`/`http.ts` directamente desde un hook o componente de fuera de esta carpeta.

## Ver también

- [`../query/README.md`](../query/README.md) *(recomendado, ver lista de READMEs sugeridos)* — cómo se cachean las respuestas de estas fachadas con React Query.
- [`../session/README.md`](../session/README.md) — de dónde sale el token que inyecta `http.ts`.
