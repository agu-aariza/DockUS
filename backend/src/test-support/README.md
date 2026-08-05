# Utilidades de soporte para tests (`test-support/`)

> **Resumen rápido:** Un único fichero, `domain-builders.ts`, con funciones fábrica que construyen entidades de dominio completas (con valores por defecto razonables) para usar en tests unitarios sin repetir objetos gigantes en cada `.spec.ts`.

---

## ¿Qué problema resuelve?

Las entidades TypeORM del dominio (`Project`, `ProjectAssignment`, `Delivery`, `StorageObject`...) tienen muchos campos obligatorios. Sin estas fábricas, cada test que necesita "un proyecto cualquiera" tendría que declarar los 15 campos a mano. `domain-builders.ts` centraliza esos valores por defecto (IDs UUID fijos y reconocibles, fechas fijas) y permite sobreescribir solo lo que el test concreto necesita vía `overrides`.

## Qué hay dentro

```text
test-support/
└── domain-builders.ts
    ├── buildActor(role, userId?)             # AuthenticatedUser de prueba (para simular @Req().user)
    ├── buildProject(overrides?)                # Project completo, status ACTIVE por defecto
    ├── buildAssignment(overrides?)               # ProjectAssignment, anidando buildProject() por defecto
    ├── buildDelivery(overrides?)                   # Delivery, anidando buildAssignment() por defecto
    ├── buildStorageObject(overrides?)                # StorageObject de rol STUDENT_SOURCE
    ├── buildUploadedStorageFile(overrides?)             # Buffer + tamaño, para simular un fichero subido
    └── createMinioStorageServiceMock()                    # jest.fn() tipados para cada método de MinioStorageService
```

Todas las funciones aceptan un `Partial<Entidad>` como `overrides` y hacen *spread* sobre los valores por defecto — el patrón estándar de "builder con overrides" para fixtures de test.

## Cómo usarlo

```typescript
import { buildDelivery, buildActor } from '../../test-support/domain-builders';
import { UserRole } from '../users/entities/user.entity';

const delivery = buildDelivery({ status: DeliveryStatus.SUBMITTED });
const teacher = buildActor(UserRole.TEACHER);
```

Si un test necesita mockear `MinioStorageService` completo en vez de solo construir un objeto, usa `createMinioStorageServiceMock()` en lugar de escribir `{ putObject: jest.fn(), ... }` a mano — mantiene el mock alineado con la interfaz real del servicio (falla en tiempo de compilación si el servicio cambia su forma).

## Cuándo añadir algo aquí

Solo cuando una entidad se construye repetidamente en 3+ ficheros de test con la misma forma base. Si es un caso muy específico de un único test, constrúyelo localmente en ese `.spec.ts` en vez de generalizarlo aquí.

## Ver también

- [`../README.md`](../README.md) — código fuente del backend.
- [`../../test/README.md`](../../test/README.md) — tests e2e, donde estas mismas fábricas también son útiles para preparar fixtures.
