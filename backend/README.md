# Backend Module

> **Resumen rápido:** Servidor NestJS y arquitectura hexagonal que proporciona la API REST, autenticación, orquestación de entregas de alumnos, evaluación mediante contenedores Docker y procesamiento de IA/LLM.

---

## Propósito y Responsabilidades
Proporcionar el núcleo de servicios backend para el ecosistema DockUS, garantizando la seguridad, persistencia de datos y ejecución aislada de evaluaciones.
- **Gestionar la lógica de negocio principal:** Proyectos, entregas, calificaciones y usuarios.
- **Orquestar el Builder y contenedores:** Ejecución segura de entornos de desarrollo y pruebas automáticas en Docker.
- **Integrar proveedores de IA/LLM:** Evaluación guiada y detección de alucinaciones o errores en entregas.

---

## Estructura Interna

```text
.
├── src/
│   ├── modules/          # Módulos de dominio (auth, academic, projects, users, health)
│   ├── shared/           # Infraestructura compartida (database, cache, ai, docker, security)
│   ├── bootstrap.ts      # Inicialización del servidor NestJS
│   ├── main.ts           # Punto de entrada de la aplicación API
│   ├── worker.ts         # Punto de entrada del worker en segundo plano
│   ├── api.module.ts     # Módulo principal para la API
│   └── worker.module.ts  # Módulo principal para el procesador worker
├── test/                 # Pruebas e2e e integración
├── .dependency-cruiser.cjs # Reglas de linteo de arquitectura
└── package.json
```

---

## Flujo de Trabajo / Arquitectura

```text
[ Cliente Frontend ]
         │
         ▼
[ NestJS API Controllers ] (presentation)
         │
         ▼
[ Application Services ] (application)
         │
    ┌────┴─────────────────────────┐
    ▼                              ▼
[ Domain Logic ]           [ Shared Infrastructure ]
(Entities & Ports)         (TypeORM, Redis, Docker, Gemini/Bedrock)
```

---

## Cómo Usar / Probar este Módulo

### Instalar dependencias:
```bash
npm install
```

### Ejecutar en modo desarrollo:
```bash
npm run start:dev
```

### Validar fronteras de arquitectura:
```bash
npm run boundaries
```

### Ejecutar tests:
```bash
npm run test
```
