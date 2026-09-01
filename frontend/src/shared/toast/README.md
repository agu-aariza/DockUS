# Notificaciones (`shared/toast/`)

> **Resumen rápido:** El contexto global de avisos no bloqueantes (`useToast()`) más un hook, `useNoticeToasts.ts`, que traduce automáticamente ciertos eventos del dominio (p. ej. avisos que llegan en un objeto de respuesta) en toasts, sin que cada componente tenga que llamar a `showToast` a mano para esos casos.

---

## Las dos piezas

```text
ToastContext.tsx        → Provider + useToast(): showToast(mensaje, tono), cola de toasts con auto-cierre
useNoticeToasts.ts        → Hook que observa una fuente de "avisos" (ToastNoticeLike) y los despacha
                             automáticamente como toasts — evita repetir showToast(...) manualmente
                             cada vez que una respuesta de API trae un aviso ya formado
```

## Cómo se usa

```typescript
const { showToast } = useToast();
showToast('Entrega calificada correctamente.', 'success');
```

`useNoticeToasts.ts` se usa cuando una fuente de datos (por ejemplo, el resultado de una mutación) ya trae avisos estructurados que deben mostrarse sin intervención manual — evita el patrón de escribir un `useEffect` con `showToast` repetido en cada componente que consume esa fuente.

## Estructura interna

```text
toast/
├── ToastContext.tsx     # Provider, useToast(), tonos (success/error/warning/info)
└── useNoticeToasts.ts     # Traducción automática de avisos de dominio a toasts
```

## Cómo trabajar aquí

```bash
npm run test -- test/unit/shared/toast
```

## Ver también

- [`../README.md`](../README.md) — los cuatro contextos globales de la aplicación (sesión, workspace, tema, toasts).
