# DockUS - Backend

Este directorio contiene el código fuente de la API principal, desarrollada utilizando **NestJS (versión 11)**. Arquitectura estructurada para ser altamente modular y escalable.

## Estructura de Directorios Principal

```text
src/
├── auth/            # IAM y Autenticación JWT / RBAC.
├── users/           # Gestión de CRUD y ciclos de vida de Usuarios.
├── app.module.ts    # Módulo raíz de la aplicación.
└── main.ts          # Punto de entrada y configuración (Swagger, Helmet, Pino Logger, Throttler, Graceful Shutdown).
```

## Entorno Local

Asegúrate de tener levantada la base de datos (PostgreSQL), la cual debería idealmente orquestarse desde la raíz del proyecto usando Docker Compose (`docker compose up -d`).

Los requerimientos que necesita el backend para operar correctamente se encuentran listados como Variables de Entorno en el `.env`.  Usa el `.env.example` en la raíz si necesitas una plantilla base.

## Scripts de Desarrollo

Para la operativa diaria puedes emplear los siguientes comandos a través de `npm`:

```bash
# Desarrollo
$ npm install
$ npm run start:dev   # Inicia el proyecto en modo watch

# Construcción
$ npm run build       # Compila el TypeScript a JS en /dist

# Calidad
$ npm run lint        # Comprueba estándares de formateo
```

## Pruebas (Tests)

El proyecto incluye tests unitarios automatizados que comprueban tanto controladores como servicios.

```bash
# Ejecutar suite de testing unitario
$ npm run test
```

## Migraciones y Base de Datos

(Actualmente, y conforme al Roadmap, se utiliza la sincronización nativa de TypeORM por defecto o scripts similares en etapas iniciales. Documentar aquí flujo de migraciones manuales a medida que se implementen).

## Convenciones de Código

* **Eslint/Prettier**: Configuraciones globales ya aplicadas.
* Patrón repositorio utilizado al interactuar con la Base de datos.
* Todas las API's bajo el prefijo global de path `/api`.
