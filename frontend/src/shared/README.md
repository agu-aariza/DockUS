# Recursos Compartidos Frontend (src/shared)

> **Resumen rápido:** Componentes de interfaz de usuario del sistema de diseño, utilidades de red, gestión de sesión y hooks compartidos.

---

## Propósito y Responsabilidades
Proporcionar una base sólida y uniforme para el desarrollo de nuevas vistas en el frontend.
- **UI Components:** Botones, modales, barras de navegación, badges e indicadores de estado.
- **Gestión de Red y Sesión:** Cliente HTTP Axios configurado (`http.ts`), almacenamiento de sesión y notificaciones Toast.

---

## Estructura Interna

```text
.
├── api/              # Cliente HTTP, interceptores y tratamiento de errores
├── components/       # Componentes visuales reutilizables (ui/, report/, file-preview/)
├── hooks/            # Hooks generales (useFocusTrap, useVisibilityAwareInterval)
├── session/          # Store de sesión y persistencia local de tokens
├── theme/            # Tokens de diseño y colores
├── toast/            # Sistema global de notificaciones Toast
├── utils/            # Funciones auxiliares (backoff, formatters)
└── workspace/        # Barras de trabajo y navegación de workspace
```

---

## Flujo de Trabajo / Arquitectura

```text
[ Feature Component ] ──> [ Shared UI Component ]
                  └──> [ Shared Session Store / HTTP Client ] ──> [ Backend API ]
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar tests de utilidades compartidas:
```bash
npm run test -- src/shared
```
