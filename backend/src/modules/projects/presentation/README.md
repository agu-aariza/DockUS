# Capa de Presentación de Proyectos (modules/projects/presentation)

> **Resumen rápido:** Controladores HTTP de NestJS que exponen la API REST de proyectos, rúbricas y entregas.

---

## Propósito y Responsabilidades
Exponer los endpoints HTTP y manejar la deserialización/validaciones de entrada.
- **Controladores HTTP:** Endpoints de creación, listado y consulta de notas.

---

## Estructura Interna

```text
.
└── ... # Controladores HTTP de proyectos
```

---

## Flujo de Trabajo / Arquitectura

```text
HTTP Request ──> [ ProjectsController ] ──> [ Application Service ] ──> HTTP Response
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar tests de presentación:
```bash
npm run test -- src/modules/projects/presentation
```
