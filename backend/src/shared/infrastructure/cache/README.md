# Infraestructura de Caché y Bloqueos (cache)

> **Resumen rápido:** Capa de almacenamiento en memoria distribuido con Redis para caché de identidades y sincronización mediante bloqueos distribuidos.

---

## Propósito y Responsabilidades
Mejorar el rendimiento del backend y garantizar la concurrencia segura en tareas de evaluación y autenticación.
- **Bloqueos distribuidos:** `DistributedLockService` para prevenir condiciones de carrera en tareas asíncronas.
- **Caché de identidades:** `AuthIdentityCacheService` para agilizar la validación de tokens y sesiones.

---

## Estructura Interna

```text
.
├── auth-identity-cache.service.ts  # Caché rápida de información de usuarios autenticados
├── cache.module.ts                 # Módulo NestJS que registra el cliente Redis
└── distributed-lock.service.ts    # Implementación de locks con Redis / Redlock
```

---

## Flujo de Trabajo / Arquitectura

```text
[ Process Worker ] ──> [ DistributedLockService ] ──> (Adquiere Lock en Redis) ──> [ Ejecuta Tarea ]
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar pruebas de caché y bloqueos:
```bash
npm run test -- src/shared/infrastructure/cache
```
