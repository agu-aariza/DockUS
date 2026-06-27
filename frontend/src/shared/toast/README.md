# frontend/src/shared/toast/

Sistema de notificaciones emergentes.

## Archivos principales

| Archivo | Función |
|---------|---------|
| [`ToastContext.tsx`](./ToastContext.tsx) | Contexto y proveedor de notificaciones con deduplicación por fingerprint. |
| [`useNoticeToasts.ts`](./useNoticeToasts.ts) | Hook para mostrar notificaciones desde componentes. |

## Notas

- Se usa para mostrar mensajes de éxito, error o advertencia sin bloquear la interfaz.
- La deduplicación evita notificaciones repetidas por la misma acción.
