# Servicios de Aplicación Compartidos (shared/application)

> **Resumen rápido:** Casos de uso transversales, puertos de lectura e infraestructura de eventos compartidos entre módulos.

---

## Propósito y Responsabilidades
Facilitar la comunicación limpia entre dominios mediante puertos y servicios de aplicación compartidos.
- **Puertos de Lectura:** `group-roster-reader.port.ts` para abstraer la consulta de listas de alumnos.
- **Servicios de Eventos:** `group-enrollment-events.service.ts` para publicar y procesar eventos de matriculación.

---

## Estructura Interna

```text
.
├── group-enrollment-events.service.ts # Servicio emisor de eventos de matriculación
├── group-roster-reader.port.ts        # Puerto de lectura de listas de alumnos
└── shared-application.module.ts       # Módulo NestJS de servicios de aplicación compartidos
```

---

## Flujo de Trabajo / Arquitectura

```text
[ Academic Module ] ──> [ group-roster-reader.port ] ──> [ Shared Application Service ]
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar tests de aplicación compartida:
```bash
npm run test -- src/shared/application
```
