# Constantes HTTP compartidas (`shared/http/`)

> **Resumen rápido:** Un único fichero, `http-response.constants.ts`, con las cadenas de descripción de error reutilizadas en los decoradores `@ApiResponse(...)` de Swagger de todos los controladores — no un filtro de excepciones global (no lo hay en esta carpeta pese a lo que el nombre podría sugerir).

---

## Qué hay exactamente aquí

```typescript
export const INVALID_INPUT_DESCRIPTION = 'Datos de entrada inválidos.';
export const INVALID_UUID_DESCRIPTION = 'El UUID proporcionado no es válido.';
export const UNAUTHORIZED_DESCRIPTION = 'Acceso no autorizado.';
export const FORBIDDEN_DESCRIPTION = 'Permisos insuficientes.';
export const INTERNAL_SERVER_ERROR_DESCRIPTION = 'Error interno del servidor.';
```

Se usan así, repetidas en decenas de endpoints (`users.controller.ts`, `auth.controller.ts`, `deliveries.controller.ts`...):

```typescript
@ApiResponse({ status: 401, description: UNAUTHORIZED_DESCRIPTION })
@ApiResponse({ status: 403, description: FORBIDDEN_DESCRIPTION })
```

El propósito es puramente evitar que el texto de "Permisos insuficientes." se escriba (y con el tiempo, diverja) en veinte sitios distintos de la documentación Swagger — es un detalle de consistencia de la especificación OpenAPI generada en `/api/docs`, no lógica de manejo de errores en tiempo de ejecución.

## Qué NO hay aquí (a pesar del nombre de la carpeta)

No hay un filtro de excepciones global, interceptor de respuesta, ni transformación de payload — el manejo real de excepciones no capturadas lo gestiona NestJS de forma estándar más las excepciones tipadas que cada servicio lanza (`NotFoundException`, `ConflictException`, etc., incluida la traducción de errores de base de datos vía [`../database/README.md`](../database/README.md)).

## Cómo trabajar aquí

```bash
npm run test -- src/shared/http
```

Si un mensaje de error HTTP se repite en 3+ controladores, añádelo aquí como constante en vez de escribirlo literal cada vez.
