# Tests end-to-end (`backend/test/`)

> **Resumen rápido:** Configuración y runner compartido para los tests e2e del backend (`*.e2e-spec.ts`), que levantan una instancia real de la app NestJS y le disparan peticiones HTTP con Supertest contra infraestructura real (Postgres, Redis, Docker).

---

## ¿Qué diferencia un test e2e de un test unitario aquí?

Los tests unitarios (`*.spec.ts`, ver [`CLAUDE.md`](../../CLAUDE.md)) viven junto al código que prueban, dentro de `src/`, y mockean sus dependencias. Los tests **e2e** (`*.e2e-spec.ts`) viven en este directorio, arrancan la aplicación NestJS completa (`Test.createTestingModule` + `app.init()`) y hacen peticiones HTTP reales vía Supertest contra ella. Solo se mockean servicios verdaderamente externos y costosos (Bedrock, proveedores tipo pasarela de pago); todo lo demás — incluyendo MinIO — se prueba contra un adaptador local real en vez de un mock, porque un mock de S3 puede divergir silenciosamente del comportamiento real.

Ejecutar estos tests requiere PostgreSQL, Redis y el daemon de Docker corriendo de verdad (por eso no forman parte del `npm test` por defecto, y CI los trata como un paso separado).

## Estado actual

Ahora mismo no hay ningún fichero `*.e2e-spec.ts` en este directorio — el arnés (harness) está listo y documentado, pero la suite está vacía. `npm run test:e2e` usa `--passWithNoTests`, así que no falla por ausencia de specs; simplemente no verifica nada hasta que se añada el primero. Si vas a escribir uno, este es el sitio.

## Estructura interna

```text
test/
├── run-jest.cjs     # Wrapper del binario de Jest usado tanto por `npm test` como por `npm run test:e2e`.
│                       Fuerza un directorio de caché propio (/tmp/educodeai-jest-cache) para evitar problemas
│                       de rutas largas/permisos en Windows y WSL.
└── jest-e2e.json    # Config de Jest específica para e2e: busca ficheros que terminan en `.e2e-spec.ts`
                        y los transforma con ts-jest.
```

## Cómo escribir un test e2e nuevo

1. Crea `test/<algo>.e2e-spec.ts`.
2. Usa `Test.createTestingModule({ imports: [ApiModule] })` (o el módulo que corresponda) y `app.init()`.
3. Dispara peticiones con `supertest(app.getHttpServer())`.
4. Limpia el estado que crees (usuarios, proyectos) al final del test — no hay rollback automático de transacción entre tests e2e.

## Cómo ejecutarlos

```bash
npm run test:e2e
```
Requiere Postgres, Redis y Docker accesibles con la configuración de `.env` — lo más simple es tenerlos levantados vía `docker compose --profile dev up` desde la raíz del repo antes de correr este comando.

## Ver también

- [`../README.md`](../README.md) — visión general del backend y comandos de test unitarios.
- [`../src/test-support/README.md`](../src/test-support/README.md) — fábricas de entidades reutilizables, útiles también aquí para construir fixtures.
