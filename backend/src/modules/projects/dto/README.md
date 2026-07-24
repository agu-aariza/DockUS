# DTOs de Proyectos (modules/projects/dto)

> **Resumen rápido:** Data Transfer Objects para la validación y tipado de las peticiones HTTP relativas a proyectos y entregas.

---

## Propósito y Responsabilidades
Validar las entradas de usuario mediante `class-validator` y `class-transformer`.
- **Validación de Payloads:** Garantizar la presencia y formato correcto de títulos, rúbricas y adjuntos.

---

## Estructura Interna

```text
.
└── ... # Clases DTO con decoradores de class-validator
```

---

## Flujo de Trabajo / Arquitectura

```text
HTTP Request Body ──> [ ValidationPipe ] ──> [ DTO Class ] ──> [ Controller Method ]
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar tests de DTOs:
```bash
npm run test -- src/modules/projects/dto
```
