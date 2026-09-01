# Entregas (`projects/deliveries/`)

> **Resumen rápido:** El intento de entrega de un alumno (`Delivery`): versión, estado, notas del profesor y calificación. Aquí se recibe y consulta la entrega — la ejecución y evaluación real del código es responsabilidad de `builder/`, nunca de este submódulo (ver el límite explícito más abajo).

---

## El modelo `Delivery`

Cada `Delivery` cuelga de una `ProjectAssignment` (`assignmentId`) y tiene una `version` (un alumno puede volver a entregar hasta `Project.maxDeliveriesPerStudent` veces). Su `status` (`DeliveryStatus`) recorre un ciclo de vida — borrador, enviada, en evaluación, evaluada — y solo puede mutarse desde dos sitios controlados:

- **Peticiones HTTP normales** (`DeliveriesCommandService.updateStatus`, con control de acceso: ¿es el alumno dueño, o un profesor con permiso?).
- **El ciclo de vida del Builder**, a través de `DeliveryStatusService.updateStatusInternal()` — el único punto sin control de acceso a propósito, porque quien lo invoca (el orquestador del Builder) ya decidió la transición al arrancar o cancelar un run; la autorización ocurrió más arriba. Antes de que existiera este servicio, `BuilderRunCommandsService` reimplementaba el mismo `find + save` a mano; centralizarlo aquí evita que un submódulo ajeno mute el estado de `Delivery` por su cuenta.

`isLate` se calcula respecto a `Project.closesAt` en el momento de la entrega. `grade` y `graderNotes` son campos que rellena el profesor (o el flujo de calificación asistida por LLM del Builder) tras la evaluación.

## Command vs. Query: por qué está partido en dos servicios

```text
DeliveriesCommandService   → create, update, updateStatus, updateGrading, remove, restore
DeliveriesQueryService     → preview, findById, findAll, toResponse
```

Es una separación CQRS ligera: las operaciones de lectura (`Query`) no necesitan las mismas dependencias ni el mismo control de acceso detallado que las de escritura (`Command`), y mantenerlas en clases separadas evita que una clase de 400 líneas mezcle ambas responsabilidades. `DeliveryStatusService` es un tercer servicio, más pequeño, específicamente para la mutación de estado "interna" descrita arriba — no para el CRUD normal.

## Estructura interna

```text
deliveries/
├── delivery-status.module.ts       # Registra DeliveryStatusService para que builder/ pueda inyectarlo
├── delivery-status.service.ts        # Mutación interna de estado, sin control de acceso (ver arriba)
├── deliveries-command.service.ts       # create/update/updateStatus/updateGrading/remove/restore — con control de acceso
├── deliveries-query.service.ts           # preview/findById/findAll/toResponse
├── delivery-lookup.util.ts                 # Helpers de búsqueda compartidos entre command y query
├── entities/delivery.entity.ts               # Tabla deliveries
└── dto/
    ├── create-delivery.dto.ts                    # Payload de creación de una entrega
    └── list-deliveries-query.dto.ts                 # Filtros + paginación de GET /deliveries
```

## Qué NO vive aquí

- **No ejecuta código ni habla con Docker.** Este submódulo solo gestiona el registro y estado de la entrega; `builder/` es quien la toma como entrada para evaluarla.
- **No sube ficheros directamente a MinIO.** Eso es `storage/` — `deliveries/` referencia los `StorageObject` ya subidos, no gestiona el `multipart/form-data`.

## Endpoints relevantes (`/deliveries`, ver `presentation/deliveries.controller.ts`)

| Método | Ruta | Qué hace |
| --- | --- | --- |
| `POST` | `/deliveries` | Crea una entrega nueva (siguiente versión de la asignación). |
| `GET` | `/deliveries` | Lista con filtros. |
| `GET` | `/deliveries/:id` | Consulta una entrega. |
| `GET` | `/deliveries/:id/preview` | Vista previa del contenido subido. |
| `PATCH` | `/deliveries/:id` | Edición (p. ej. notas del alumno). |
| `PATCH` | `/deliveries/:id/status/:status` | Transición de estado manual. |
| `PATCH` | `/deliveries/:id/grading` | El profesor asigna nota/comentarios. |
| `DELETE` | `/deliveries/:id` / `PATCH /deliveries/:id/restore` | Borrado lógico y restauración. |

## Cómo trabajar aquí

```bash
npm run test -- test/unit/modules/projects/deliveries
```

## Ver también

- [`../builder/README.md`](../builder/README.md) — quién consume una `Delivery` para evaluarla.
- [`../storage/README.md`](../storage/README.md) — cómo llega el fichero antes de que exista la `Delivery`.
