# Seeders de desarrollo (`shared/infrastructure/seed/`)

> **Resumen rápido:** Dos seeders idempotentes — uno crea el usuario administrador inicial, otro puebla datos de demostración (profesor, alumnos, grupo, proyecto de ejemplo). Nunca se ejecutan en producción.

---

## La excepción arquitectónica que vive aquí

`shared/` tiene prohibido importar de `modules/` en el resto del backend — es una regla de dependencia unidireccional estricta. Este directorio es la **única excepción documentada y permanente**: `admin-seed.service.ts` importa `User`, y `demo-seed.service.ts` importa además `Project`/`ProjectAssignment`/`Delivery`, porque poblar datos de demostración necesita inherentemente conocer esas entidades. Está cubierta por una excepción explícita en `.dependency-cruiser.cjs` — no la extiendas a otros ficheros de `shared/`; si otro servicio de `shared/` cree necesitar una entidad de dominio, es una señal de que esa lógica no pertenece a `shared/`, no una razón para ampliar esta excepción.

## Idempotencia: por qué se puede ejecutar mil veces sin duplicar nada

Ambos seeders comprueban primero si el dato ya existe (por email, por título de proyecto) antes de crearlo. Esto permite que corran automáticamente cada vez que arranca el proceso en `development` sin generar usuarios ni proyectos duplicados en reinicios sucesivos — a diferencia de una migración, que se ejecuta una vez y queda registrada, un seeder se diseña para ser seguro de re-ejecutar indefinidamente.

## Los dos servicios

```text
seed/
├── admin-seed.service.ts   # Crea (si no existe) el usuario ADMIN inicial, con credenciales de SEED_ADMIN_EMAIL/*
└── demo-seed.service.ts    # Crea un profesor, varios alumnos, un grupo académico y un proyecto de ejemplo,
                              usando SEED_DEMO_PASSWORD para las cuentas de demostración
```

## Cuándo corren

Ambos se registran desde `shared/infrastructure/infrastructure.module.ts` (la otra mitad de esta misma excepción arquitectónica) y se disparan al arrancar el proceso — nunca en `production`. Revisa la condición de entorno antes de modificar cuándo se ejecutan: sembrar datos de demostración en un entorno de producción real sería un incidente de seguridad, no un bug cosmético.

## Cómo trabajar aquí

```bash
npm run test -- test/unit/shared/infrastructure/seed
```

Si necesitas más datos de demostración, amplía `demo-seed.service.ts` manteniendo la comprobación de idempotencia — nunca insertes sin comprobar existencia previa.

## Ver también

- [`../../README.md`](../../README.md) — la regla `no-shared-to-modules` y por qué esta carpeta es una excepción permanente.
- [`../infrastructure.module.ts`](../infrastructure.module.ts) — dónde se registran estos servicios (la otra mitad documentada de la excepción).
