# Arquitectura del Backend

Este documento define las convenciones de estructura para mantener escalabilidad y consistencia en el backend.

## Capas y responsabilidades

- `src/modules/`: contextos de dominio (ejemplo: `auth`, `users`, `health`).
- `src/shared/`: infraestructura técnica y configuración transversal.
- `src/app.module.ts`: ensamblador principal de módulos, sin lógica de negocio.
- `src/main.ts` y `src/bootstrap.ts`: entrada y configuración global HTTP.

## Reglas de dependencia

- Los módulos de `src/modules/` pueden depender de `src/shared/`.
- `src/shared/` no depende de módulos de dominio.
- Evitar imports cruzados entre módulos salvo a través de interfaces/servicios explícitos.

## Convenciones para nuevos módulos

Al crear un nuevo contexto de dominio:

1. Crear carpeta en `src/modules/<contexto>/`.
2. Incluir `*.module.ts`, `*.controller.ts`, `*.service.ts`.
3. Ubicar DTOs en `dto/`, entidades en `entities/`, guards/estrategias dentro del módulo.
4. Registrar el módulo en `src/app.module.ts`.

## Calidad mínima antes de merge

- `npm run lint`
- `npm run test`
- `npm run test:e2e`
- `npm run build`
