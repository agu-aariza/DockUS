# Utilidades puras (`shared/utils/`)

> **Resumen rápido:** Cinco funciones puras, sin inyección de dependencias de NestJS, sin estado, cada una resolviendo un problema pequeño y repetido en varios módulos: extraer un mensaje de un error de tipo desconocido, hashear contenido, calcular metadatos de paginación, normalizar rutas y convertir strings de configuración a boolean.

---

## Las cinco funciones

| Fichero | Función | Para qué se usa |
| --- | --- | --- |
| `error-message.util.ts` | `toErrorMessage(error, fallback?)` | TypeScript tipa `catch (error)` como `unknown`. Esta función centraliza "si es un `Error`, usa `.message`; si no, usa un mensaje de reserva" — evita que cada `catch` reimplemente el mismo `if (error instanceof Error)`. |
| `hash.util.ts` | `toSha256Hex(content)` | SHA-256 en hexadecimal. Usado para la huella de integridad de ficheros subidos (`storage/`) y de artefactos del Builder (`builder/infrastructure/evidence/`) — siempre calculado por el servidor, nunca confiado del cliente. |
| `pagination.util.ts` | `buildPaginationMeta(page, limit, total)` | Calcula `totalPages`, `hasNextPage`, `hasPrevPage` a partir de los tres valores base. El complemento de salida de [`../dto/README.md`](../dto/README.md) (`PaginatedQueryDto`, que valida la entrada). |
| `path.util.ts` | `toPosixPath(input)` | Normaliza separadores de ruta a `/`. Necesario porque el Builder procesa archivos subidos que pueden llevar rutas con separadores de Windows (`\`), y todo el análisis de seguridad de rutas (`isUnsafeRelativePath` en `builder/infrastructure/utils/`) asume POSIX. |
| `to-boolean.util.ts` | Convierte `string \| boolean` a `boolean` | Centraliza cómo se interpreta una variable de entorno tipo `"true"`/`"false"` (case-insensitive; cualquier otra cosa es `false`) — evita que cada servicio que lee un flag de configuración reimplemente su propia heurística. |

## Por qué esta carpeta tiene una regla tan estricta ("sin DI de NestJS")

Es la única forma de garantizar que estas funciones sean trivialmente testeables (sin `TestingModule`, sin mocks) y reutilizables desde *cualquier* capa — incluido `domain/`, que tiene prohibido depender de infraestructura pero puede importar funciones puras sin problema. Si una "utilidad" necesita `@Injectable()` o inyectar un servicio, no pertenece aquí — pertenece a `shared/infrastructure/` o al módulo de dominio correspondiente.

## Cómo trabajar aquí

```bash
npm run test -- src/shared/utils
```

Antes de añadir una función nueva, confirma que de verdad no tiene dependencias (ni de NestJS, ni de una librería con estado) y que resuelve algo genérico — si es específica de un dominio (p. ej. una regla de negocio de proyectos), no pertenece a `shared/`.

## Ver también

- [`../dto/README.md`](../dto/README.md) — `PaginatedQueryDto`, el complemento de entrada de `buildPaginationMeta`.
