# Tipos por dominio (`src/features/`)

> **Resumen rápido:** Una capa de tipos TypeScript puros que refleja los contratos del backend por dominio. No contiene componentes React, llamadas HTTP, hooks ni lógica de presentación.

## Regla de la capa

`features/<dominio>/` solo puede declarar o reexportar tipos, enums y constantes de datos. Puede importar contratos compartidos y tipos transversales (por ejemplo, los tipos de sesión), pero nunca `react`, `react-dom`, una carpeta `api/` o una carpeta `hooks/`. ESLint mantiene estas restricciones para evitar que `features/` se convierta en una segunda implementación de cada dominio.

La UI que representa un tipo vive en el dominio propietario: por ejemplo, los badges de estado están en `projects/components/`, `deliveries/components/` y `builder/components/`, no junto a los tipos.

## Los nueve dominios

```text
features/
├── auth/types.ts          # SessionRecord, AuthResponse, UserStatus...
├── builder/types.ts       # BuildRunEntity, BuildRunEvent, BuilderOutcome...
├── deliveries/types.ts    # DeliveryEntity, DeliveryStatus...
├── groups/types.ts        # CourseGroup, GroupEnrollment...
├── health/types.ts        # ReadinessDependency, ReadinessReport...
├── llm/types.ts           # LLM_PROVIDER_IDS y configuración por proveedor
├── projects/types.ts      # Project, ProjectStatus...
├── storage/types.ts       # StorageObjectEntity, DownloadUrlResponse...
└── students/types.ts      # Perfil/expediente del alumno
```

Cada `types.ts` reexporta, con alias donde el nombre local difiere, tipos que en última instancia proceden de `@educodeai/contracts` (el paquete compartido con el backend). No se redefinen contratos de forma independiente.

## Cómo trabajar aquí

```bash
npm run test -- test/unit/features
```

Al añadir un tipo nuevo, revisa primero si ya existe en `@educodeai/contracts` — si el backend ya lo expone, reexpórtalo desde aquí en vez de redeclararlo desde cero.

## Ver también

- [`../shared/README.md`](../shared/README.md) — la capa transversal, que no conoce dominios.
- [`../../../shared/contracts/README.md`](../../../shared/contracts/README.md) — la fuente de verdad de estos tipos, compartida con el backend.
