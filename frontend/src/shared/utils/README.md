# Utilidades puras (`shared/utils/`)

> **Resumen rápido:** Seis funciones puras sin estado ni componentes React: backoff de reintentos, extracción de mensaje de error de la API, formateo, hash SHA-256 en cliente, comprobación de rol, y validación de feedback técnico.

---

## Las seis funciones

| Fichero | Qué hace |
| --- | --- |
| `backoff.ts` | Calcula el retraso entre reintentos de una petición fallida (backoff exponencial), usado por lógica de reconexión (p. ej. el *fallback* a polling de `useBuilderRunStream` cuando el SSE se cae). |
| `errors.ts` | `getErrorMessage(error)` — extrae un mensaje legible de un `ApiErrorPayload` de forma segura, sin asumir su forma exacta. El equivalente en el frontend de `toErrorMessage` en el backend. |
| `format.ts` | Formateo de fechas, tamaños de fichero, duraciones — usado en tablas y tarjetas de toda la app. |
| `hash.ts` | `computeSha256Hex(file)` — calcula el SHA-256 de un fichero **en el cliente**, con la Web Crypto API (`crypto.subtle.digest`), antes de subirlo. Se usa para verificar contra el hash que el servidor recalcula al recibirlo (ver `backend/src/shared/utils/hash.util.ts`) — dos cálculos independientes de la misma huella, ninguno confía ciegamente en el otro. |
| `permissions.ts` | `hasRole(session, roles)` — comprobación de rol reutilizada por `useManagementPermissions.ts` y directamente por componentes que necesitan una comprobación puntual. |
| `technicalFeedback.ts` | Validación/normalización de los niveles y severidades de feedback técnico (`TechnicalFeedbackLevel`/`Severity`) antes de renderizarlos. |

## Cómo trabajar aquí

```bash
npm run test -- src/shared/utils
```

Misma regla que en el backend: si una función necesita estado, un hook de React, o conocer un componente concreto, no pertenece aquí.

## Ver también

- [`../session/README.md`](../session/README.md) — `hasRole()` en uso.
- [`../../../../backend/src/shared/utils/README.md`](../../../../backend/src/shared/utils/README.md) — el equivalente del backend, incluida la otra mitad del cálculo de hash de integridad.
