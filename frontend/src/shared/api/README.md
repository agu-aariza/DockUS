## Propósito de la carpeta
Contiene los clientes HTTP, interceptores y métodos tipados para comunicarse con todos los endpoints del backend.

## Límites y Reglas Estrictas
Los archivos aquí NUNCA deben contener lógica de interfaz gráfica, manejo de estado de React, ni depender de componentes visuales. Solo funciones asíncronas puras.

## Anti-Patrones y Gotchas ⚠️
No guardar tokens o información de sesión en el módulo directamente; usar interceptores dinámicos configurados desde `SessionContext`. Evitar URLs hardcodeadas.

## Dependencias de Contexto Asumidas
Requiere configuración previa del interceptor HTTP si se necesita autenticación, y asume que el backend respeta los tipos retornados.

## Inputs / Outputs Esperados
Funciones que reciben DTOs o parámetros primitivos y devuelven Promesas resolviendo objetos tipados del backend.

## Ejemplo de uso
```typescript
import { apiGetDeliveries } from '@/shared/api/deliveriesApi';

const data = await apiGetDeliveries({ projectId: 1 });
```

## Formato de Archivos
- `http.ts` para configuración base.
- `<Domain>Api.ts` para agrupación de endpoints de dominio.
