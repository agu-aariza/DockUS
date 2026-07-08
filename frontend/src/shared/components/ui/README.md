## Propósito de la carpeta
Proporciona el sistema de diseño base: botones, inputs, tablas, modales y layouts estructurales agnósticos de datos.

## Límites y Reglas Estrictas
PROHIBIDO importar dependencias de la lógica de negocio o de `api/`. Estos componentes deben ser 100% aislados y puramente visuales (dumb components).

## Anti-Patrones y Gotchas ⚠️
No inyectar estilos custom o overrides inline que rompan la consistencia del tema global. No mutar el estado global desde aquí.

## Dependencias de Contexto Asumidas
Asume la presencia de un tema global o framework CSS base.

## Inputs / Outputs Esperados
Propiedades estándar HTML/React extendidas con variantes visuales (ej. `variant="primary"`).

## Ejemplo de uso
```tsx
import { Button } from '@/shared/components/ui/Button';

<Button variant="danger" onClick={handleDelete}>Borrar</Button>
```

## Formato de Archivos
Componentes tipados exportados nombrados en PascalCase (`Button.tsx`, `Alert.tsx`).
