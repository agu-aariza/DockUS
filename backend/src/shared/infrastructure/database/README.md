## Propósito de la carpeta
Alojamiento de la configuración concreta de TypeORM y la definición del `DatabaseModule` para inyectar la base de datos PostgreSQL a toda la aplicación.

## Límites y Reglas Estrictas
- NUNCA activar `synchronize: true` en producción. Solo es para `development` y `test`.
- Las entidades deben auto-descubrirse o registrarse adecuadamente aquí usando rutas relativas seguras (`autoLoadEntities: true`).

## Anti-Patrones y Gotchas ⚠️
- Incluir queries SQL manuales o repositorios concretos. Esto es solo inicialización y configuración.

## Dependencias de Contexto Asumidas
- Depende de que las variables de entorno de BD hayan sido validadas por `ConfigModule`.

## Inputs / Outputs Esperados
- Define un `TypeOrmModule.forRootAsync(...)`.

## Ejemplo de uso
Añadido en el módulo principal:
```typescript
import { DatabaseModule } from 'src/shared/infrastructure/database/database.module';

@Module({
  imports: [DatabaseModule],
})
export class InfrastructureModule {}
```

## Formato de Archivos
- Ficheros de configuración de módulo de NestJS (`*.module.ts`, `*.config.ts`).
