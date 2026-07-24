# Módulos de Dominio de Negocio (src/modules)

> **Resumen rápido:** Módulos de aplicación independientes que implementan las reglas de negocio principales de DockUS (autenticación, gestión académica, usuarios y proyectos/builder).

---

## Propósito y Responsabilidades
Organizar las funcionalidades del sistema según el dominio de la aplicación siguiendo arquitectura hexagonal.
- **Segregación funcional:** Cada carpeta representa un contexto delimitado (Bounded Context).
- **Independencia:** Los módulos se comunican mediante interfaces, eventos o inyección de dependencias NestJS.

---

## Estructura Interna

```text
.
├── academic/      # Gestión de grupos académicos, matrículas y asignaturas
├── auth/          # Autenticación, JWT, roles y permisos
├── health/        # Endpoints de verificación de estado (liveness / readiness)
├── projects/      # Gestión de proyectos, entregas, correcciones y el subdominio builder
└── users/         # Gestión de perfiles de usuario y profesores
```

---

## Flujo de Trabajo / Arquitectura

```text
[ API Gateway / NestJS App ]
         │
         ├──> [ Auth Module ]
         ├──> [ Academic Module ]
         ├──> [ Users Module ]
         └──> [ Projects Module ] ──> [ Builder Submodule ]
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar tests de todos los módulos:
```bash
npm run test -- src/modules
```
