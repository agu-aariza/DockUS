# Cliente API HTTP (shared/api)

> **Resumen rápido:** Cliente HTTP configurado con Axios, inyección de tokens JWT, interceptores y manejo de errores de red.

---

## Propósito y Responsabilidades
Centralizar las comunicaciones HTTP del frontend hacia la API NestJS backend.
- **Interceptores de Petición:** Inyección del token Bearer JWT recuperado de la sesión.
- **Interceptores de Respuesta:** Tratamiento global de errores 401/403 y redirección automática.

---

## Estructura Interna

```text
.
├── http.ts       # Instancia configurada de Axios con interceptores
└── http.spec.ts  # Pruebas unitarias de interceptores HTTP
```

---

## Flujo de Trabajo / Arquitectura

```text
[ Feature Hook ] ──> [ http.ts (Axios) ] ──> Interceptor Add Token ──> [ API Backend ]
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar tests del cliente HTTP:
```bash
npm run test -- src/shared/api
```
