# Filtros y Transformadores HTTP (shared/http)

> **Resumen rápido:** Filtros globales de excepciones HTTP, interceptores de respuesta y formateadores de payload API.

---

## Propósito y Responsabilidades
Normalizar la respuesta de la API HTTP y gestionar de forma centralizada las excepciones no capturadas.
- **Global Exception Filter:** Captura de errores NestJS y conversión a respuestas JSON estándar RFC 7807.
- **Transformación de Respuestas:** Formateo consistente de metadatos y payloads.

---

## Estructura Interna

```text
.
└── ... # Interceptores y filtros de excepciones HTTP
```

---

## Flujo de Trabajo / Arquitectura

```text
[ Controller Exception ] ──> [ GlobalExceptionFilter ] ──> Formato JSON Estandarizado (4xx/5xx)
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar tests de filtros HTTP:
```bash
npm run test -- src/shared/http
```
