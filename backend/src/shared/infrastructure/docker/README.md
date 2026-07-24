# Integración de Docker (docker)

> **Resumen rápido:** Comunicación con el Docker Daemon para construir imágenes, ejecutar contenedores de evaluación aislados y publicar el estado del servicio.

---

## Propósito y Responsabilidades
Gestionar el ciclo de vida de los contenedores Docker donde se compilan y evalúan las entregas de los estudiantes.
- **Gestión de imágenes:** `DockerImageService` para construir y verificar imágenes de ejecución.
- **Monitoreo de Daemon:** `DockerDaemonStatusPublisherService` para supervisar la disponibilidad de la infraestructura Docker.

---

## Estructura Interna

```text
.
├── docker-daemon-status-publisher.service.ts # Publicador periódicos del estado del daemon
└── docker-image.service.ts                    # Construcción y gestión de imágenes Docker
```

---

## Flujo de Trabajo / Arquitectura

```text
[ Builder Pipeline ] ──> [ DockerImageService ] ──> [ Docker Socket / Daemon ] ──> (Contenedor Aislado)
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar pruebas del cliente Docker:
```bash
npm run test -- src/shared/infrastructure/docker
```
