## Propósito de la carpeta
Definir las políticas de rate limiting global que protegen los endpoints de la API contra ataques de fuerza bruta y saturación de peticiones (DDoS/Flood).

## Límites y Reglas Estrictas
- Se utilizan dos cubos de rate limiting con `@nestjs/throttler`: `global` (ventanas largas, e.g. 1000req/60s para navegación normal) y `burst` (ventanas cortas, e.g. 40req/1s para evitar scripts rápidos).
- Esta configuración debe estar activa en todos los entornos productivos.

## Anti-Patrones y Gotchas ⚠️
- Los endpoints de autenticación (`/auth/login`) están altamente expuestos a fuerza bruta. NUNCA deben depender solo de los límites globales, deben sobrescribir los límites usando el decorador `@Throttle()` con valores mucho más bajos (ej. 3req/1s).
- Rate limits extremadamente estrictos en el bucket global pueden causar que paneles complejos que hacen varias peticiones GET (dashboard, workspaces) fallen repentinamente.

## Dependencias de Contexto Asumidas
- Se asume el uso de `ThrottlerModule` de NestJS en `AppModule`.

## Inputs / Outputs Esperados
- Provee un array de configuración compatible con `ThrottlerModule.forRoot()`.

## Ejemplo de uso
```typescript
import { throttlerConfig } from 'src/shared/infrastructure/security/throttler.config';

@Module({
  imports: [
    ThrottlerModule.forRoot(throttlerConfig),
  ],
})
export class AppModule {}
```

## Formato de Archivos
- Exporta constantes de configuración inmutables (`*.config.ts`).
