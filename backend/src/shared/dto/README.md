# DTOs Compartidos del Backend (shared/dto)

> **Resumen rápido:** Data Transfer Objects genéricos para paginación, ordenación y filtrado de consultas HTTP en el backend.

---

## Propósito y Responsabilidades
Estandarizar los parámetros de consulta recibidos en los controladores de la API.
- **Paginación Genérica:** `paginated-query.dto.ts` para validar `page`, `limit` y parámetros de ordenación.

---

## Estructura Interna

```text
.
└── paginated-query.dto.ts # DTO estándar de consulta paginada con class-validator
```

---

## Flujo de Trabajo / Arquitectura

```text
GET /endpoint?page=1&limit=20 ──> [ PaginatedQueryDto ] ──> [ Controller ]
```

---

## Cómo Usar / Probar este Módulo

### Importar DTO en un controlador:
```typescript
import { PaginatedQueryDto } from '../shared/dto/paginated-query.dto';
```
