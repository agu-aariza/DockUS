## Responsabilidad del Módulo
Provee endpoints de monitoreo para comprobar la disponibilidad y estado (liveness y readiness) del backend y de sus dependencias críticas.

## Lo que este módulo NO hace (Anti-Goals) ⚠️
No ejecuta procesos de reparación, no gestiona métricas complejas de negocio, ni controla el ciclo de vida de los servicios a los que hace ping.

## Conceptos Clave (Glosario)
- **Liveness**: Indica si el proceso HTTP principal está vivo y respondiendo.
- **Readiness**: Indica si la aplicación está lista para procesar tráfico validando la conexión con sus dependencias.

## Dependencias Externas Clave
- **PostgreSQL**: Vía `DataSource` de TypeORM.
- **Redis**: Vía `RedisClientService`.
- **Docker daemon**: Vía `DockerHostService`.
- **AWS Bedrock**: Valida acceso listando modelos de la región.

## Efectos Secundarios (Side Effects)
Solo operaciones de lectura (ping) en las dependencias. No altera ningún estado en bases de datos, cachés ni servicios externos.

## Estado / BBDD
No posee entidades ni estado propio.

## Puntos de Entrada (Entrypoints)
- `health.controller.ts`: Endpoints `GET /health/live` y `GET /health/ready`.
