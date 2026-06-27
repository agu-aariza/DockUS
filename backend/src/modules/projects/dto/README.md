# backend/src/modules/projects/dto/

Data Transfer Objects (DTOs) del módulo de proyectos. Definen la forma de los datos que entran y salen de los endpoints de proyectos.

## Uso

- Los DTOs de entrada se validan con `class-validator` y `class-transformer`.
- Los DTOs de salida tipan las respuestas de la API.

## Notas

- Mantener alineados con los tipos del frontend en `frontend/src/shared/types.ts`.
- Los campos sensibles (como rutas internas de artefactos) deben controlarse en los DTOs de salida.
