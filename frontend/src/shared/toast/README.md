## Propósito de la carpeta
Contiene el contexto global y hooks para manejar notificaciones efímeras (toasts) en toda la aplicación.

## Límites y Reglas Estrictas
El renderizado del toast se hace en un único punto del DOM a través del Contexto. No acoplar el diseño del toast a la lógica del dominio emisor.

## Anti-Patrones y Gotchas ⚠️
Evitar generar múltiples toasts en bucle que bloqueen o inunden la interfaz gráfica del usuario.

## Dependencias de Contexto Asumidas
Requiere envolver la app con `ToastProvider` cerca de la raíz para que los `useToast` funcionen en cualquier componente.

## Inputs / Outputs Esperados
Métodos `showToast`, `success`, `error` que aceptan un mensaje de texto y opciones.

## Ejemplo de uso
```tsx
import { useNoticeToasts } from '@/shared/toast/useNoticeToasts';

const { notifySuccess } = useNoticeToasts();
notifySuccess("Cambios guardados");
```

## Formato de Archivos
Archivos de contexto de React y hooks (`ToastContext.tsx`, `useNoticeToasts.ts`).
