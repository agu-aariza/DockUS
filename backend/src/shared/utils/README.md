## Propósito de la carpeta
Contiene utilidades puras agnósticas de dominio. Proporciona funciones helper para cálculos genéricos de paginación, conversiones de tipos y operaciones aritméticas o lógicas simples utilizadas en todo el backend.

## Límites y Reglas Estrictas
- NINGUNA dependencia de módulos de negocio.
- NO pueden tener inyección de dependencias de NestJS (deben ser funciones exportadas puras, fáciles de testear).

## Anti-Patrones y Gotchas ⚠️
- Incluir lógica de negocio encubierta o validaciones que corresponden a DTOs.
- Crear clases complejas instanciables para utilidades puras.

## Dependencias de Contexto Asumidas
- Cero dependencias externas complejas. Solo TypeScript estándar y eventualmente lodash o utilidades nativas ligeras.

## Inputs / Outputs Esperados
- Inputs primitivos, outputs predecibles sin efectos secundarios.

## Ejemplo de uso
```typescript
import { buildPaginationMeta } from 'src/shared/utils/pagination.util';
import { toBoolean } from 'src/shared/utils/to-boolean.util';

const isFeatureActive = toBoolean(process.env.FEATURE_FLAG);
const meta = buildPaginationMeta(currentPage, limit, totalItems);
```

## Formato de Archivos
- Archivos pequeños con nombres descriptivos `<concepto>.util.ts`.
