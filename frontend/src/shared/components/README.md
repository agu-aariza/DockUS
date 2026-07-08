## Propósito de la carpeta
Agrupa componentes React complejos, compuestos y de negocio cruzado que son reutilizados por múltiples pantallas, como modales, visores de código y reportes.

## Límites y Reglas Estrictas
No deben hacer data-fetching directo que esté acoplado a un caso de uso particular (pasar datos por props). Deben ser puros respecto al negocio en la medida de lo posible.

## Anti-Patrones y Gotchas ⚠️
No añadir aquí componentes muy específicos de una vista que solo se usarán una vez. Evitar acoplamiento con contextos de dominio específicos.

## Dependencias de Contexto Asumidas
Dependen frecuentemente de `shared/components/ui` para las primitivas visuales y `shared/utils` para formateo.

## Inputs / Outputs Esperados
Componentes React que reciben `props` con datos tipados, funciones de callback para eventos (ej. `onClose`) y devuelven `JSX.Element`.

## Ejemplo de uso
```tsx
import { TerminalViewer } from '@/shared/components/TerminalViewer';

<TerminalViewer logs={buildLogs} />
```

## Formato de Archivos
Componentes en formato PascalCase (`Component.tsx`) con sus respectivas pruebas unitarias cerca (`Component.spec.tsx`).
