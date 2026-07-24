# Módulo de Salud y Diagnóstico (modules/health)

> **Resumen rápido:** Endpoints de salud técnica de la aplicación (`/health/live` y `/health/readiness`) para la verificación de liveness y readiness del servidor NestJS e infraestructura.

---

## Propósito y Responsabilidades
Exponer la disponibilidad operativa del backend y la conectividad con sus dependencias críticas (PostgreSQL, Redis, Docker, Amazon Bedrock).
- **Liveness Check (`/health/live`):** Confirma que el proceso HTTP de la API está vivo y respondiendo solicitudes.
- **Readiness Check (`/health/readiness`):** Comprueba conectividad real con PostgreSQL, Redis, Docker y Bedrock antes de recibir tráfico de usuarios u orquestadores.

---

## Estructura Interna

```text
.
├── health.controller.ts # Endpoints /health/live y /health/readiness
├── health.service.ts    # Lógica de comprobación de conectividad con servicios
└── health.module.ts     # Módulo NestJS que registra el servicio y controlador de salud
```

---

## Flujo de Trabajo / Arquitectura

```text
[ Docker Healthcheck / Orquestador ] ──> GET /health/live ──> [ HealthController ] ──> HTTP 200 OK
[ Load Balancer / Readiness Probe ] ──> GET /health/readiness ──> [ HealthService ] ──> HTTP 200 OK / 503
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar tests de salud:
```bash
npm run test -- src/modules/health
```
