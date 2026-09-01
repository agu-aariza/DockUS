# Transporte HTTP (`shared/api/`)

> **Resumen rápido:** Esta carpeta contiene únicamente el transporte HTTP transversal: la instancia Axios configurada en `http.ts` y los helpers de parámetros. Los clientes de cada dominio viven junto al dominio que representan.

---

## Dónde viven los clientes de dominio

Cada `*Api.ts` vive cerca del dominio al que sirve, para que los componentes y hooks importen directamente el cliente que necesitan:

```text
auth/api/authApi.ts
users/api/usersApi.ts
projects/api/{projectsApi,assignmentsApi}.ts
groups/api/groupsApi.ts
deliveries/api/deliveriesApi.ts
storage/api/storageApi.ts
builder/api/builderApi.ts
llm/api/llmApi.ts
student/api/studentsApi.ts
health/api/healthApi.ts
```

## Estructura interna

```text
api/
├── http.ts               # La instancia axios: interceptores de token JWT, manejo global de 401/403
└── query-params.ts       # Serialización consistente de query params
```

El test de los interceptores está en [`../../../test/unit/shared/api/http.spec.ts`](../../../test/unit/shared/api/http.spec.ts).

## `http.ts`: qué pasa en cada petición

Cada petición sale con el token JWT de la sesión activa inyectado por un interceptor (leído de `shared/session/`). Un interceptor de respuesta trata globalmente los `401`/`403` — no cada componente decide individualmente qué hacer cuando el token expira. El *stream* SSE del Builder (`GET /builder/runs/:id/stream`) **no** pasa por esta instancia de axios: usa `fetch` + `ReadableStream` directamente en `builder/hooks/useBuilderRunStream.ts`, porque necesita la cabecera `Authorization` en una conexión de streaming que `EventSource` no soporta.

## Cómo trabajar aquí

```bash
npm run test -- test/unit/shared/api
```

Si añades un endpoint nuevo, añade el método en el `*Api.ts` del dominio correspondiente (créalo si el dominio es nuevo). Los clientes de dominio deben importar `http` y `query-params` desde esta carpeta; los hooks y componentes no deben llamar a Axios directamente.

## Ver también

- [`../query/README.md`](../query/README.md) *(recomendado, ver lista de READMEs sugeridos)* — cómo se cachean las respuestas de estas fachadas con React Query.
- [`../session/README.md`](../session/README.md) — de dónde sale el token que inyecta `http.ts`.
