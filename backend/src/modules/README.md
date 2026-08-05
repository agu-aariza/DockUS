# Módulos de dominio (`src/modules/`)

> **Resumen rápido:** Cada subcarpeta es un módulo NestJS autocontenido que representa un contexto delimitado (bounded context) del negocio: autenticación, usuarios, gestión académica, salud del sistema, y el gran módulo de proyectos (que a su vez contiene el motor de evaluación "Builder").

---

## ¿Qué es un "módulo" aquí?

En NestJS, un módulo (`@Module({...})`) es una unidad de composición: agrupa controladores, servicios y proveedores, y declara explícitamente qué importa de otros módulos y qué exporta. Cada carpeta de este directorio exporta exactamente un `[Nombre]Module` (p. ej. `AuthModule`, `UsersModule`) que se importa desde `core.module.ts`. Los módulos se comunican entre sí por inyección de dependencias o eventos de dominio — nunca importando directamente las clases internas de otro módulo.

## Los cinco módulos

```text
modules/
├── auth/       # Emisión/refresco de JWT, guards (JwtAuthGuard, RolesGuard). NO gestiona el CRUD de usuarios.
├── users/      # CRUD de identidad: roles (STUDENT/TEACHER/ADMIN), soft delete. NO emite tokens.
├── academic/   # Grupos de curso y matriculación (incl. en bloque). Publica eventos de dominio que otros módulos escuchan.
├── health/     # Sondas de liveness/readiness (Postgres, Redis, Docker, Bedrock).
└── projects/   # El hub de dominio: proyectos, asignaciones, entregas, storage y el motor Builder — ver projects/README.md
```

Nota la separación deliberada entre `auth/` (cómo demostrar quién eres) y `users/` (quién eres): son responsabilidades distintas a propósito, para poder, por ejemplo, cambiar la estrategia de autenticación sin tocar el modelo de usuario.

`academic/` es el origen de los eventos de matriculación: cuando un profesor matricula alumnos en un grupo, `academic/` publica un evento de dominio que `projects/assignments/` escucha para conceder acceso automáticamente a los proyectos asignados a ese grupo — así `academic/` no necesita saber nada sobre proyectos.

## Convención de capas

Los módulos que poseen persistencia (`academic`, `users`, `projects` y sus submódulos) siguen esta estructura interna:

```text
<módulo>/
├── presentation/   # Controladores REST — solo HTTP
├── application/    # Casos de uso / lógica de negocio
├── domain/         # Entidades, interfaces de repositorio (puertos), tipos — sin TypeORM
└── infrastructure/ # Adaptadores TypeORM que implementan los puertos de domain/
```

`auth/` y `health/` no tienen persistencia propia (no son "dueños" de ninguna tabla), así que permanecen "planos": sus ficheros viven directamente en la raíz del módulo sin esas cuatro subcarpetas.

## Cómo trabajar aquí

```bash
npm run test -- src/modules          # tests unitarios de todos los módulos
npm run test -- src/modules/auth     # tests de un módulo concreto
npm run boundaries                    # verifica que ningún módulo rompa las fronteras hexagonales
```

Al añadir un endpoint nuevo: el controlador (`presentation/`) valida el DTO de entrada, delega en un servicio de `application/`, y ese servicio es el único que puede tocar `domain/` e `infrastructure/`. Si el controlador necesita hablar con Docker, MinIO o el LLM directamente, es una señal de que esa lógica debería vivir en `application/`, no en `presentation/`.

## Ver también

- [`projects/README.md`](projects/README.md) — el módulo más grande, con el motor de evaluación Builder.
- [`../README.md`](../README.md) — el código fuente del backend en conjunto.
