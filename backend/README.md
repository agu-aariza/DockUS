# DockUS - Backend

API principal construida con NestJS 11 y TypeScript.

## Organización de carpetas (actual)

```text
backend/
├── src/
│   ├── modules/                   # Contextos de dominio
│   │   ├── auth/                  # Autenticación y autorización
│   │   ├── users/                 # Gestión de usuarios y RBAC
│   │   └── health/                # Endpoints de salud (live/readiness)
│   ├── shared/                    # Capa transversal técnica
│   │   ├── config/                # Contratos y validación de entorno
│   │   └── infrastructure/        # DB, cola, logger, seguridad global
│   ├── app.module.ts              # Composición de módulos
│   ├── bootstrap.ts               # Configuración global HTTP compartida
│   └── main.ts                    # Entry point del proceso
├── test/                          # Suite e2e
├── ARCHITECTURE.md                # Reglas de arquitectura y dependencias
├── package.json
└── tsconfig.json
```

## Criterio de diseño

- Dominio en `modules/`.
- Infraestructura técnica y configuración en `shared/`.
- `AppModule` como ensamblador, no como contenedor de lógica de infraestructura.

## Entorno local

Desde la raíz del repo:

```bash
docker compose up -d
cd backend
npm install
npm run start:dev
```

## Scripts de trabajo

```bash
npm run lint
npm run test
npm run test:e2e
npm run build
```

## Notas de configuración

- El backend carga variables de entorno desde `../.env` (raíz del repositorio).
- La validación de entorno se aplica en arranque con Joi (fail-fast).
