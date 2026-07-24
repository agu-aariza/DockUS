# Seguridad y Control de Frecuencia (security)

> **Resumen rápido:** Mecanismos de protección contra sobrecargas, limitación de frecuencia de peticiones (throttling) y guardias de seguridad.

---

## Propósito y Responsabilidades
Proteger la API contra abusos, peticiones masivas no autorizadas y ataques de denegación de servicio.
- **Throttling personalizado:** `DockusThrottlerGuard` para limitar peticiones por IP, usuario o endpoint.

---

## Estructura Interna

```text
.
└── dockus-throttler.guard.ts # Guardia NestJS para la restricción de tasa de peticiones
```

---

## Flujo de Trabajo / Arquitectura

```text
[ Cliente HTTP ] ──> [ DockusThrottlerGuard ] ──> (Petición Aceptada) ──> [ Controller ]
                                             └──> (Petición Rechazada) ──> HTTP 429
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar pruebas del throttler:
```bash
npm run test -- src/shared/infrastructure/security
```
