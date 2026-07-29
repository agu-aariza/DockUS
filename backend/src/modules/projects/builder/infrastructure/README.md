# Infraestructura del Motor Builder (builder/infrastructure)

> **Resumen rápido:** Adaptadores de infraestructura del builder: manejadores de eventos, almacenamiento de evidencias y utilidades de ejecución.

---

## Propósito y Responsabilidades
Conectar la lógica de orquestación del builder con los adaptadores de almacenamiento y mensajería.
- **Eventos de Infraestructura:** Publicación y recepción de eventos de cambio de estado de ejecuciones (`events/`).
- **Almacenamiento de Evidencias:** Persistencia de logs de consola, artefactos de prueba y reportes (`evidence/`).

---

## Estructura Interna

```text
.
├── events/   # Clases de evento y escuchadores (event listeners)
├── evidence/ # Servicios de captura y almacenamiento de evidencias de ejecución
└── utils/    # Utilidades de ruta y transformación de payloads POSIX
```

`BuilderLlmConfigService`/`BuilderLlmProviderTester` vivían aquí (`config/`) pero se movieron a `application/services/config/`: son casos de uso (leen/escriben configuración vía el puerto `ILlmConfigurationRepository`, no TypeORM directo), no infraestructura (ARQ-024).

---

## Flujo de Trabajo / Arquitectura

```text
[ Builder Stage ] ──> [ EventPublisher ] ──> [ BuilderEventListener ] ──> [ Redis Pub/Sub ]
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar tests de infraestructura del builder:
```bash
npm run test -- src/modules/projects/builder/infrastructure
```
