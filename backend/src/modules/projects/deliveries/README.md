# backend/src/modules/projects/deliveries/

Submódulo de entregas versionadas de los alumnos. Gestiona el almacenamiento del código entregado, su previsualización y el lanzamiento de evaluaciones.

## Archivos principales

| Archivo | Función |
|---------|---------|
| `deliveries.controller.ts` | Endpoints para subir, listar, previsualizar y calificar entregas. |
| `deliveries.service.ts` | Lógica de gestión de entregas. |
| `entities/delivery.entity.ts` | Entidad `Delivery` con versión y metadatos. |
| `dto/create-delivery.dto.ts` | DTO para crear una entrega. |

## Notas

- Cada entrega pertenece a una `ProjectAssignment`.
- El alumno puede realizar múltiples entregas hasta alcanzar el límite configurado.
- Desde una entrega se puede lanzar un `BuildRun` para evaluarla.
