# Submódulo de Asignaciones de Proyectos (assignments)

> **Resumen rápido:** Asignación de prácticas a grupos docentes, control de fechas límite, eventos de matriculación y visibilidad de proyectos.

---

## Propósito y Responsabilidades
Gestionar la vinculación entre una definición de proyecto y los grupos de alumnos que deben realizarlo.
- **Fechas Límite:** Establecimiento de plazos de entrega y periodos de gracia por grupo (`project-assignments.service.ts`).
- **Escuchador de Eventos:** Reacción a eventos de matriculación de estudiantes en grupos (`project-assignment-group-enrollment.listener.ts`).

---

## Estructura Interna

```text
.
├── dto/                                            # DTOs de creación y actualización de asignaciones
├── entities/                                       # Entidades TypeORM ProjectAssignment
├── project-assignment-group-enrollment.listener.ts # Event listener de cambios en matrículas
└── project-assignments.service.ts                  # Servicio de negocio para asignaciones
```

---

## Flujo de Trabajo / Arquitectura

```text
[ Profesor UI ] ──> Asignar Proyecto a Grupo ──> [ ProjectAssignmentsService ] ──> [ PostgreSQL ]
[ Evento Grupo ] ──> [ ProjectAssignmentGroupEnrollmentListener ] ──> Actualiza Estado Asignación
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar tests de asignaciones:
```bash
npm run test -- src/modules/projects/assignments
```
