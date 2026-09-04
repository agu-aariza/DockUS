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

## Compatibilidad y cambios

El paquete se consume mediante `file:../shared/contracts` desde backend y frontend; no tiene un build ni runtime independiente. Los contratos son tipos de compilación: no sustituyen la validación de DTOs del backend ni garantizan que un servidor antiguo entienda un cliente nuevo.

Al cambiar una forma que cruza la API:

1. Mantén compatibilidad hacia atrás cuando sea posible.
2. Actualiza backend, frontend y sus tests en el mismo cambio.
3. Revisa Swagger y las respuestas serializadas, no solo el tipo TypeScript.
4. Si el cambio rompe consumidores, documenta la migración y coordina el despliegue.

## Cómo verificarlo

No hay una suite propia para este paquete. La comprobación se realiza compilando ambos consumidores:

```bash
cd backend && npm run typecheck
cd ../frontend && npm run typecheck
```

No añadas lógica ejecutable, secretos, acceso a red ni dependencias de NestJS/React a `index.ts`.

---

## Cómo Usar / Probar este Módulo

### Importar contratos en backend o frontend:
```typescript
import { BuildRunStage } from '@educodeai/contracts';
```
