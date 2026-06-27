# Infrastructure: Queue (RabbitMQ)

## Descripción General
Este módulo (actualmente en definición) está destinado a gestionar la infraestructura de colas de mensajes de DockUS, basándose previsiblemente en RabbitMQ u otro bróker de mensajería compatible. Su objetivo es proporcionar un mecanismo asíncrono para la comunicación entre los distintos dominios del backend, garantizando alta disponibilidad, escalabilidad y tolerancia a fallos.

## Responsabilidades
- **Mensajería asíncrona:** Desacoplar procesos pesados (ej. orquestación de contenedores, compilaciones, generación de reportes).
- **Enrutamiento y Tópicos:** Permitir que múltiples módulos escuchen eventos de dominio específicos sin conocer el origen.
- **Fiabilidad (Reliability):** Manejo de reintentos, Dead Letter Queues (DLQ) y ack/nack de mensajes.

## Árbol de Directorios
```text
queue/
└── README.md
```

## Detalle de Ficheros

- **`README.md`**
  - **Propósito:** Documentar el propósito y diseño del módulo de infraestructura de colas.
  - **Responsabilidad:** Servir como guía arquitectónica para la integración de mensajería asíncrona.
  - **Conexiones:** Relacionado conceptualmente con otros submódulos de `infrastructure` (como `docker` y `storage`), siendo un pilar fundamental para arquitecturas dirigidas por eventos (Event-Driven Architecture) en DockUS.

> **Nota para Modelos de IA:** Actualmente este directorio contiene únicamente documentación. Cualquier futura implementación de servicios (ej. `RabbitMQService`, `queue-infrastructure.module.ts`) deberá adherirse al principio de inyección de dependencias de NestJS y abstraer la lógica del bróker para el resto de los módulos de dominio.
