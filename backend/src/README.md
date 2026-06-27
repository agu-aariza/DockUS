# backend/src/

Código fuente de la API NestJS. Aquí viven los módulos de dominio, la infraestructura compartida y el punto de entrada de la aplicación.

## Estructura

```
src/
├── main.ts              # Punto de entrada HTTP
├── bootstrap.ts         # Configuración global (CORS, Helmet, Swagger, ValidationPipe)
├── app.module.ts        # Módulo raíz que ensambla infraestructura + dominios
├── modules/             # Módulos de dominio de negocio
│   ├── auth/
│   ├── users/
│   ├── academic/
│   └── projects/
├── shared/              # Infraestructura transversal y utilidades
│   ├── config/
│   ├── database/
│   ├── http/
│   ├── infrastructure/
│   ├── utils/
│   └── test-support/
└── test-support/        # Builders de dominio para tests
```

## Archivos más importantes

| Archivo | Función |
|---------|---------|
| [`main.ts`](./main.ts) | Crea la aplicación Nest y la pone a escuchar en `PORT`. |
| [`bootstrap.ts`](./bootstrap.ts) | Aplica middleware global: CORS, Helmet, Swagger, `ValidationPipe`, rate limiting. |
| [`app.module.ts`](./app.module.ts) | Importa `InfrastructureModule` y todos los módulos de dominio. |

## Convenciones

- Cada módulo de dominio agrupa su propio `controllers/`, `services/`, `dto/`, `entities/` y submódulos cuando sea necesario.
- La carpeta `shared/` contiene solo código transversal: configuración, base de datos, colas, Docker, LLM, storage, logging, etc.
- Los tests unitarios viven junto al código (`*.spec.ts`) salvo los e2e, que están en [`backend/test/`](../test/README.md).
