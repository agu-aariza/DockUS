## Propósito (TL;DR)
Punto de entrada principal y configuración raíz de la API NestJS.

## Arquitectura de alto nivel
Monolito modular basado en NestJS, separando dominios de negocio (módulos) e infraestructura transversal (shared).

## Límites Arquitectónicos (Boundaries) ⚠️
El código aquí (main.ts, bootstrap.ts) NUNCA debe contener lógica de negocio. Toda la lógica de dominio debe residir estrictamente dentro de `modules/`.

## Flujo Principal de Datos
Las peticiones HTTP entran por `main.ts`, pasan por los middlewares globales configurados en `bootstrap.ts` (CORS, Helmet, ValidationPipe), y son enrutadas por `app.module.ts` hacia el módulo de dominio correspondiente.

## Stack Tecnológico Principal
TypeScript, NestJS.

## Mapa de Directorios (Tree)
- `main.ts`: Punto de entrada HTTP.
- `bootstrap.ts`: Configuración de middleware global y utilidades.
- `app.module.ts`: Módulo raíz de inyección de dependencias.
- `modules/`: Módulos de dominio de negocio.
- `shared/`: Infraestructura transversal y utilidades compartidas.
- `test-support/`: Helpers y builders para tests.

## Variables de Entorno Globales
- `PORT`: Puerto de escucha del servidor HTTP.

## Comandos clave
- `npm run start:dev`: Levanta el servidor en modo desarrollo.
