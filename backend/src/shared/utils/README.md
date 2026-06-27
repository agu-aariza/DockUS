# backend/src/shared/utils/

Utilidades generales reutilizables en cualquier módulo del backend.

## Archivos principales

| Archivo | Función |
|---------|---------|
| `pagination.util.ts` | Helpers para construir metadatos de paginación (`page`, `limit`, `total`, `totalPages`). |
| `to-boolean.util.ts` | Conversión robusta de strings a booleanos (`'true'`, `'1'`, `'yes'`, etc.). |

## Uso típico

```ts
import { buildPaginationMeta } from '../../shared/utils/pagination.util';

const meta = buildPaginationMeta(page, limit, total);
```

## Notas

- Mantener estas utilidades libres de dependencias de dominio para facilitar su reutilización.
- No incluir aquí lógica específica de negocio; para eso existen los módulos de dominio.
