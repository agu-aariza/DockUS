# Módulo de Entregas y Calificaciones (src/deliveries)

> **Resumen rápido:** Hooks y componentes para la gestión y revisión de entregas por parte de profesores y alumnos.

---

## Propósito y Responsabilidades
Facilitar la consulta del estado de entregas y el proceso de evaluación manual o automática.
- **Gestión de Calificaciones:** Custom hooks para calificar entregas (`useDeliveryManagement`).

---

## Estructura Interna

```text
.
└── hooks/ # Custom hooks de gestión de entregas (useDeliveryManagement)
```

---

## Flujo de Trabajo / Arquitectura

```text
[ Delivery Management Panel ] ──> [ useDeliveryManagement ] ──> [ API HTTP /deliveries ]
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar tests del módulo de entregas:
```bash
npm run test -- src/deliveries
```
