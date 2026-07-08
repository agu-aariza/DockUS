## Propósito de la carpeta
Almacenar constantes, tipos y estructuras de datos reutilizables asociadas a protocolos web, códigos de estado HTTP y formatos de respuesta, evitando números mágicos o strings literales en los controladores.

## Límites y Reglas Estrictas
- NINGUNA lógica de negocio.
- NINGUNA dependencia de base de datos o herramientas complejas.
- Constantes agnósticas (generalmente usando Enums o constantes inmutables).

## Anti-Patrones y Gotchas ⚠️
- Usar `404` directamente en el código de NestJS; en su lugar usar `HttpStatus.NOT_FOUND` y complementarlo con las constantes estandarizadas de mensajes definidas aquí si es necesario.

## Dependencias de Contexto Asumidas
- Solo depende de JS/TS básico. Usado en controladores y filtros de excepción.

## Inputs / Outputs Esperados
Exportación de strings y diccionarios estáticos.

## Ejemplo de uso
```typescript
import { HTTP_MESSAGES } from 'src/shared/http/http.constants';
import { NotFoundException } from '@nestjs/common';

throw new NotFoundException(HTTP_MESSAGES.RESOURCE_NOT_FOUND);
```

## Formato de Archivos
- Constantes agrupadas y exportadas (`*.constants.ts`).
