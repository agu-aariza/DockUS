# Hooks genéricos (`shared/hooks/`)

> **Resumen rápido:** Dos hooks sin ningún conocimiento de dominio, cada uno resolviendo un problema real ya detectado en producción: accesibilidad de teclado en modales (`useFocusTrap`) y sondeos de fondo que no distinguían una pestaña activa de una olvidada (`useVisibilityAwareInterval`).

---

## `useFocusTrap.ts`

Atrapa el foco de teclado dentro de un diálogo modal mientras está abierto. Sin esto, `Tab` podía sacar el foco hacia elementos del fondo de la página mientras el *backdrop* seguía bloqueando visualmente la interacción — un usuario que navega solo con teclado quedaba "atascado" en un control invisible detrás del modal, sin ninguna pista visual de dónde estaba el foco. Al cerrarse el modal, devuelve el foco a quien lo abrió — el comportamiento que las *WAI-ARIA Authoring Practices* esperan de cualquier diálogo modal accesible.

```typescript
const containerRef = useFocusTrap<HTMLDivElement>(isOpen, initialFocusRef);
// <div ref={containerRef}> ...contenido del modal... </div>
```

Se usa en todos los modales de la aplicación (`DangerConfirmModal`, `GroupDialogs`, `PreviewOrGradingModal`, etc.) — cualquier modal nuevo debería usarlo también en vez de confiar en el comportamiento por defecto del navegador.

## `useVisibilityAwareInterval.ts`: un incidente real, no una optimización preventiva

El comentario del propio código documenta el problema que motivó este hook: las notificaciones de evaluación disparaban dos peticiones cada 15 segundos por alumno conectado — con 10.000 sesiones simultáneas, **incluso sin ninguna actividad real**, eso sostenía del orden de 1.300 peticiones/segundo contra la API (y, a través de ella, contra PostgreSQL). En un aula real, la mayoría de esas pestañas están detrás de otra ventana en un momento dado. `useVisibilityAwareInterval` sustituye a un `setInterval` ingenuo por uno que:

1. **Se suspende por completo** mientras `document.visibilityState === 'hidden'` — cero peticiones de una pestaña en segundo plano.
2. **Ejecuta una pasada inmediata al recuperar visibilidad** — quien vuelve a la pestaña espera ver el estado actual, no esperar un ciclo completo del intervalo.
3. **Dispersa esa pasada de recuperación con un pequeño *jitter*** (`computeBackoffDelay`, hasta 750ms) — sin esto, un patrón muy común (cambiar de aplicación y volver, por ejemplo al terminar una explicación en clase) alinearía a decenas de alumnos del mismo aula pidiendo datos en el mismo instante exacto, recreando en miniatura el mismo problema que el hook existe para evitar.

```typescript
useVisibilityAwareInterval(() => refetchStatus(), 15_000, isRunActive);
```

## Estructura interna

```text
hooks/
├── useFocusTrap.ts                # Atrapa foco de teclado en modales
└── useVisibilityAwareInterval.ts    # setInterval consciente de Page Visibility API, con jitter al recuperar foco
```

## Cómo trabajar aquí

```bash
npm run test -- test/unit/shared/hooks
```

Cualquier sondeo periódico nuevo (polling de estado, *fallback* de un stream SSE caído) debería pasar por `useVisibilityAwareInterval` en vez de un `setInterval` directo — es la lección ya aprendida de un incidente real de carga, no una precaución teórica.

## Ver también

- [`../utils/README.md`](../utils/README.md) — `computeBackoffDelay`, usado por el *jitter* de recuperación.
- [`../../builder/README.md`](../../builder/README.md) — el *fallback* a polling de `useBuilderRunStream`, un consumidor natural de este mismo patrón.
