## Propósito de la carpeta
Agrupa funciones puras utilitarias para validaciones, transformaciones de texto, manejo de errores, fechas y hashing.

## Límites y Reglas Estrictas
Estas funciones deben ser PURAS. No pueden importar componentes de React, y no pueden mantener estado interno ni ejecutar llamadas al backend.

## Anti-Patrones y Gotchas ⚠️
No añadir funciones relacionadas al estado global, ni mezclar lógicas que aplican únicamente a un módulo particular de negocio.

## Dependencias de Contexto Asumidas
Ninguna. Todo debe poder ser probado de manera aislada (unit test fácil).

## Inputs / Outputs Esperados
Datos primitivos de entrada produciendo un dato formateado o procesado (ej. String a String).

## Ejemplo de uso
```typescript
import { formatBytes } from '@/shared/utils/format';

const sizeStr = formatBytes(1024); // "1 KB"
```

## Formato de Archivos
Agrupaciones por temática en camelCase (ej. `format.ts`, `errors.ts`, `hash.ts`).
