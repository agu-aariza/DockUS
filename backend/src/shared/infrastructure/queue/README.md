## Propósito de la carpeta
Proveer una abstracción y configuración base para la mensajería asíncrona y procesamiento en segundo plano (colas). Actual o conceptualmente maneja BullMQ / RabbitMQ.

## Límites y Reglas Estrictas
- NINGUNA lógica de dominio (como Jobs específicos de "Evaluación" o "Compilación") debe vivir aquí.
- Los módulos de negocio deben inyectar interfaces de productores genéricos definidos aquí, si aplica.

## Anti-Patrones y Gotchas ⚠️
- Mezclar la configuración de la conexión de caché genérica (PubSub/Healthcheck) con el Worker Thread que consume los mensajes de la cola (requieren bloqueos diferentes).

## Dependencias de Contexto Asumidas
- Se asume un broker activo (Redis para BullMQ, o RabbitMQ).

## Inputs / Outputs Esperados
- Provee servicios de infraestructura en forma de inyectables (ej. `QueueService`).

## Ejemplo de uso
```typescript
// Conceptual
constructor(private readonly queueManager: IQueueManager) {}

async dispatchEvent() {
    await this.queueManager.publish('builder_events', { action: 'start' });
}
```

## Formato de Archivos
- Exporta configuración y módulos globales de NestJS para colas.
