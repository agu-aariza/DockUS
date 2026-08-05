# Paquete de Contratos Compartidos (@educodeai/contracts)

> **Resumen rápido:** Paquete compartido entre el backend NestJS y el frontend React que define las interfaces de API, DTOs y tipos de datos comunes.

---

## Propósito y Responsabilidades
Garantizar la coherencia de tipos (Type-Safety) en todo el ciclo de petición y respuesta entre el cliente y el servidor.
- **Tipado Unificado:** Interfaces de usuarios, proyectos, entregas, ejecuciones del builder y estados de respuesta.
- **Sin Dependencias de Ejecución:** Paquete ligero expuesto mediante `index.ts`.

---

## Estructura Interna

```text
.
├── index.ts     # Exportación de todos los tipos, enums e interfaces compartidas
└── package.json # Definición del paquete interno @educodeai/contracts
```

---

## Flujo de Trabajo / Arquitectura

```text
[ Backend DTOs / Services ] ──> import { DeliveryStatus } from '@educodeai/contracts'
[ Frontend API Client ]      ──> import type { Delivery } from '@educodeai/contracts'
```

---

## Cómo Usar / Probar este Módulo

### Importar contratos en backend o frontend:
```typescript
import { BuildRunStage } from '@educodeai/contracts';
```
