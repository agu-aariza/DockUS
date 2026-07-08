## Propósito de la carpeta
Contenedor de todos los módulos de dominio de negocio del backend. Cada subcarpeta representa un contexto acotado independiente (ej. auth, users, academic).

## Límites y Reglas Estrictas
Cada módulo debe estar contenido en su propia carpeta y exportar un único `[Nombre]Module`. No se permite código suelto en este directorio.

## Anti-Patrones y Gotchas ⚠️
Evitar dependencias circulares entre módulos. Si dos módulos se necesitan mutuamente, extraer la lógica compartida o usar eventos de dominio.

## Dependencias de Contexto Asumidas
Requiere que `app.module.ts` importe e inyecte estos módulos en la aplicación principal.

## Inputs / Outputs Esperados
N/A (Carpeta estructural).

## Ejemplo de uso
```typescript
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [UsersModule, AuthModule],
})
export class AppModule {}
```

## Formato de Archivos
Solo subdirectorios con módulos NestJS.
