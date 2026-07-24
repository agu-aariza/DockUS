# Dominio del Motor Builder (builder/domain)

> **Resumen rápido:** Entidades, tipos, catálogo de runtimes de ejecución y utilidades de capacidad del dominio del motor de compilación.

---

## Propósito y Responsabilidades
Definir las reglas de negocio puras del motor de ejecución sin acoplamiento a infraestructura.
- **Catálogo de Runtimes:** Definición de imágenes Docker soportadas (Node, Python, Java, etc.) en `runtime-catalog.ts`.
- **Capacidad de Workers:** Cálculo de concurrencia máxima permitida según la memoria disponible (`worker-capacity.util.ts`).

---

## Estructura Interna

```text
.
├── ai/                        # Subdominio de parsers y utilidades de IA
├── entities/                  # Entidades puras del builder
├── builder-config.provider.ts # Proveedor de configuración del builder
├── builder.constants.ts       # Constantes del ciclo de vida de ejecuciones
├── builder.types.ts           # Tipos de datos e interfaces del builder
├── runtime-catalog.ts         # Catálogo y registro de entornos de ejecución Docker
└── worker-capacity.util.ts    # Utilidad de cálculo de capacidad y memoria de workers
```

---

## Flujo de Trabajo / Arquitectura

```text
[ Builder Orchestrator ] ──> [ RuntimeCatalog.resolve(lang) ] ──> Docker Image Spec
                         ──> [ WorkerCapacityUtil.calculateMax() ] ──> Max Concurrency
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar tests del dominio del builder:
```bash
npm run test -- src/modules/projects/builder/domain
```
