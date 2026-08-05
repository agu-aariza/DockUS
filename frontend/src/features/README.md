# Tipos por dominio (`src/features/`)

> **Resumen rápido:** Un espejo, en tipos TypeScript puros, de cada dominio del backend: `auth`, `builder`, `deliveries`, `groups`, `health`, `llm`, `projects`, `storage`, `students`. Sin lógica, sin llamadas a API — con una excepción pequeña y deliberada, ver más abajo.

---

## La regla (y su única excepción)

`CLAUDE.md` la enuncia así: `features/<domain>/` son tipos/DTOs/constantes puros que reflejan los dominios del backend — nada de React, nada de llamadas a API, nada de UI. En la práctica, tres dominios (`builder/`, `deliveries/`, `projects/`) tienen una carpeta `components/` con un badge minúsculo (`BuilderOutcomeBadge.tsx`, `DeliveryOutcomeBadge.tsx`, `DeliveryStatusBadge.tsx`, `ProjectStatusBadge.tsx`) colocado junto al enum que renderiza — por ejemplo, `ProjectStatusBadge.tsx` mapea `ProjectStatus` a un `<StatusBadge tone=... />` de `shared/components/ui/`. Es una excepción deliberada y consistente (se repite igual en los tres dominios, no es un descuido aislado): mantener el mapeo enum→presentación pegado a la definición del enum evita que diverjan si el backend añade un valor nuevo. Cualquier lógica que no sea "un enum, un color, una etiqueta" no pertenece aquí — eso sí va al dominio (`<dominio>/components/`) o a `shared/components/`.

## Los nueve dominios

```text
features/
├── auth/types.ts          # SessionRecord, AuthResponse, UserStatus...
├── builder/                 # BuildRunEntity, BuildRunEvent, BuilderOutcome... + components/BuilderOutcomeBadge.tsx
├── deliveries/                 # DeliveryEntity, DeliveryStatus... + components/{Delivery,DeliveryStatus}Badge.tsx
├── groups/types.ts               # CourseGroup, GroupEnrollment...
├── health/types.ts                  # ReadinessDependency, ReadinessReport...
├── llm/types.ts                        # LLM_PROVIDER_IDS, formas de configuración por proveedor
├── projects/                             # Project, ProjectStatus... + components/ProjectStatusBadge.tsx
├── storage/types.ts                         # StorageObjectEntity, DownloadUrlResponse...
└── students/types.ts                           # Perfil/expediente del alumno
```

Cada `types.ts` re-exporta, con alias donde el nombre local difiere, tipos que en última instancia proceden de `@educodeai/contracts` (el paquete de tipos compartido con el backend) — no son una redefinición independiente y potencialmente divergente, son la forma local de consumir esos mismos contratos.

## Cómo trabajar aquí

```bash
npm run test -- src/features
```

Al añadir un tipo nuevo, revisa primero si ya existe en `@educodeai/contracts` — si el backend ya lo expone, reexpórtalo desde aquí en vez de redeclararlo desde cero.

## Ver también

- [`../shared/README.md`](../shared/README.md) — la otra mitad de la capa transversal (no tipada por dominio).
- [`../../../shared/contracts/README.md`](../../../shared/contracts/README.md) — la fuente de verdad de estos tipos, compartida con el backend.
