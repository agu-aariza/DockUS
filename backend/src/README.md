# Directores y Código Fuente Backend (src)

> **Resumen rápido:** Código fuente de la aplicación NestJS, estructurado en módulos de dominio de negocio y componentes de infraestructura compartidos.

---

## Propósito y Responsabilidades
Contener la implementación completa del servidor NestJS siguiendo los principios de arquitectura limpia y segregación por procesos (API HTTP y Workers de fondo).
- **Segregación de roles de proceso:** Permite ejecutar la API web y los procesadores asíncronos mediante `process-role.module.ts`.
- **Estructura modular:** Organización independiente de módulos de dominio y servicios globales.

---

## Estructura Interna

```text
.
├── modules/              # Módulos del dominio de la aplicación (auth, projects, academic, etc.)
├── shared/               # Servicios de infraestructura y configuración reutilizables
├── api.module.ts         # Módulo raíz para el rol de proceso API
├── core.module.ts        # Módulo central con proveedores globales
├── process-role.module.ts # Selector dinámico de módulos según el rol del contenedor
├── worker.module.ts      # Módulo raíz para el rol de trabajador en segundo plano
├── bootstrap.ts          # Configuración e inicialización común de NestJS
├── main.ts               # Punto de entrada HTTP
└── worker.ts             # Punto de entrada del worker BullMQ
```

---

## Flujo de Trabajo / Arquitectura

```text
main.ts ──> bootstrap() ──> process-role.module ──> api.module ──> [ HTTP Controllers & Services ]
worker.ts ──> bootstrap() ──> process-role.module ──> worker.module ──> [ BullMQ Processors ]
```

---

## Cómo Usar / Probar este Módulo

### Compilar el código TypeScript:
```bash
npm run build
```

### Ejecutar validación de arquitectura:
```bash
npm run boundaries
```
