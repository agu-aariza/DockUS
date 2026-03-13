# DockUS - Backend

API principal construida con NestJS 11 y TypeScript.

## Organización de carpetas (actual)

```text
backend/
├── src/
│   ├── config/                    # Contratos y validación de entorno
│   │   └── env.validation.ts
│   ├── infrastructure/            # Infraestructura transversal (no dominio)
│   │   ├── infrastructure.module.ts
│   │   ├── database/typeorm.config.ts
│   │   ├── observability/logger.config.ts
│   │   ├── queue/bull.config.ts
│   │   └── security/throttler.config.ts
│   ├── auth/                      # Contexto de autenticación y autorización
│   ├── users/                     # Contexto de usuarios y RBAC
│   ├── app.module.ts              # Composición de módulos
│   ├── bootstrap.ts               # Configuración global HTTP compartida
│   └── main.ts                    # Entry point del proceso
├── test/                          # Suite e2e
├── package.json
└── tsconfig.json
```

## Criterio de diseño

- Dominio en `auth/` y `users/`.
- Infraestructura técnica en `infrastructure/`.
- Configuración declarativa en `config/`.
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
