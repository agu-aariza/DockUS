# Frontend Module

> **Resumen rápido:** Aplicación Single Page Application (SPA) en React, TypeScript, Vite y TailwindCSS para profesores y estudiantes de la plataforma DockUS.

---

## Propósito y Responsabilidades
Proporcionar la interfaz de usuario moderna, interactiva y accesible del sistema DockUS.
- **Vistas para Estudiantes:** Panel de entregas, estado de evaluaciones en tiempo real y resultados.
- **Vistas para Profesores:** Gestión de grupos, proyectos, rúbricas, visualización de ejecuciones y analíticas.

---

## Estructura Interna

```text
.
├── src/
│   ├── auth/         # Autenticación y formularios de entrada
│   ├── builder/      # Monitorización en vivo de ejecuciones y consolas
│   ├── groups/       # Gestión de grupos docentes
│   ├── llm/          # Configuración e interacción con IA
│   ├── projects/     # Gestión y configuración de proyectos y rúbricas
│   ├── runtime/      # Paneles de gestión de runtimes de ejecución
│   ├── shared/       # Componentes UI reutilizables, hooks, sesión y clientes HTTP
│   ├── student/      # Flujo completo de navegación y entregas del estudiante
│   ├── summary/      # Dashboards de analíticas del cohorte
│   └── users/        # Panel de administración de usuarios
├── public/           # Archivos estáticos y favicon
├── vite.config.ts    # Configuración del empaquetador Vite
└── package.json
```

---

## Flujo de Trabajo / Arquitectura

```text
[ Browser / Usuario ] ──> [ React Router / App Shell ]
                                   │
                                   ├──> [ Student Section ] ──> [ API HTTP / SSE Stream ]
                                   └──> [ Teacher Section ] ──> [ API HTTP / WebSockets ]
```

---

## Cómo Usar / Probar este Módulo

### Instalar dependencias:
```bash
npm install
```

### Ejecutar servidor de desarrollo Vite:
```bash
npm run dev
```

### Ejecutar pruebas frontend (Vitest):
```bash
npm run test
```
