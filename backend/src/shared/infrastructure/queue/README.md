# Infraestructura de Colas (shared/infrastructure/queue)

> **Resumen rápido:** Configuración de colas BullMQ respaldadas por Redis para el procesamiento asíncrono de tareas pesadas de evaluación.

---

## Propósito y Responsabilidades
Permitir el desacoplamiento entre las peticiones HTTP y el procesamiento en segundo plano.
- **Configuración BullMQ:** Conexión con Redis y opciones de reintento.
- **Encolado de Trabajos:** Productores de tareas de evaluación e inspección de trabajos.

---

## Estructura Interna

```text
.
└── ... # Módulo NestJS de colas e integración BullMQ
```

---

## Flujo de Trabajo / Arquitectura

```text
[ API Controller ] ──> QueueProducer.add(job) ──> Redis / BullMQ ──> [ Worker Processor ]
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar tests de colas:
```bash
npm run test -- src/shared/infrastructure/queue
```
