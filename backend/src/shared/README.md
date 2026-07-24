# Infraestructura Compartida (src/shared)

> **Resumen rápido:** Capa de infraestructura y utilidades transversales utilizadas por todos los módulos del sistema (base de datos, caché, seguridad, clientes de IA y Docker).

---

## Propósito y Responsabilidades
Proporcionar adaptadores de bajo nivel y configuraciones globales sin acoplarse a la lógica específica de negocio de los módulos.
- **Abstraer servicios externos:** Gestión de TypeORM, Redis/ioredis, clientes de IA (Gemini/Bedrock), almacenamiento MinIO y cliente Docker.
- **Implementar utilidades transversales:** Bloqueos distribuidos, limitadores de tasa (throttling), seguridad y logging.

---

## Estructura Interna

```text
.
├── config/             # Configuración centralizada de variables de entorno y Joi validation
├── infrastructure/     # Adaptadores concretos a servicios y librerías externas
│   ├── ai/             # Integraciones de LLM y disyuntores (circuit breakers)
│   ├── cache/          # Servicio de caché distribuido e identidades
│   ├── database/       # Conexión TypeORM y migraciones de esquemas
│   ├── docker/         # Gestión de daemon y contenedores Docker
│   ├── queue/          # Configuración de colas de trabajos asíncronos
│   ├── security/       # Guards de throttling y mecanismos de seguridad
│   └── storage/        # Adaptador para MinIO / S3
├── http/               # Filtros de excepciones globales y transformaciones HTTP
└── utils/              # Funciones auxiliares genéricas (backoff, hashing, formatters)
```

---

## Flujo de Trabajo / Arquitectura

```text
[ Módulo de Dominio ] ──> (Usa Puertos / Interfaces) ──> [ Shared Infrastructure Adaptor ]
                                                                   │
                                                                   ▼
                                                       [ Servicio Externo ]
                                                       (PostgreSQL, Redis, Docker, Gemini)
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar pruebas de infraestructura compartida:
```bash
npm run test -- src/shared
```
