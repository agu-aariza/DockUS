# Paquete de Contratos Compartidos (@dockus/contracts)

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
└── package.json # Definición del paquete interno @dockus/contracts
```

---

## Flujo de Trabajo / Arquitectura

```text
[ Backend DTOs / Services ] ──> import { DeliveryStatus } from '@dockus/contracts'
[ Frontend API Client ]      ──> import type { Delivery } from '@dockus/contracts'
```

---

## Cómo Usar / Probar este Módulo

### Importar contratos en backend o frontend:
```typescript
import { BuildRunStage } from '@dockus/contracts';
```
