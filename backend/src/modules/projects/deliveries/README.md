# Submódulo de Entregas de Alumnos (deliveries)

> **Resumen rápido:** Recepción, validación de estado y consulta de entregas de código realizadas por los estudiantes.

---

## Propósito y Responsabilidades
Manejar el ciclo de vida de la entrega de una práctica por parte de un estudiante o equipo.
- **Registro de Entrega:** Recepción de ficheros, metadatos y asignación de versión.
- **Estado de Evaluación:** `DeliveryStatusService` para actualizar el estado del procesamiento.

---

## Estructura Interna

```text
.
├── delivery-status.module.ts  # Módulo NestJS del estado de entregas
├── delivery-status.service.ts # Servicio de gestión y transición de estados de entrega
└── ...
```

---

## Flujo de Trabajo / Arquitectura

```text
[ Estudiante UI ] ──> Subir Código ──> [ DeliveriesController ] ──> [ DeliveryStatusService ] ──> Pendiente
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar tests de entregas:
```bash
npm run test -- src/modules/projects/deliveries
```
