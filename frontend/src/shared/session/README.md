# Gestión de Sesión de Usuario (shared/session)

> **Resumen rápido:** Store de estado de sesión (`sessionStore.ts`) para el almacenamiento seguro de tokens y datos del usuario activo.

---

## Propósito y Responsabilidades
Mantener la información del usuario autenticado en la memoria del navegador y sincronizada en LocalStorage.
- **Persistencia de Token:** Almacenamiento seguro del JWT.
- **Estado Global:** Exposición del usuario activo a toda la aplicación.

---

## Estructura Interna

```text
.
├── sessionStore.ts       # Implementación del store de sesión
└── sessionStore.spec.ts  # Pruebas unitarias de gestión de sesión
```

---

## Flujo de Trabajo / Arquitectura

```text
[ Auth Login Success ] ──> sessionStore.setSession(user, token) ──> LocalStorage
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar tests de sesión:
```bash
npm run test -- src/shared/session
```
