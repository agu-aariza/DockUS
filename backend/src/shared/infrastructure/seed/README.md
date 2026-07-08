## Propósito de la carpeta
Poblar la base de datos con un estado mínimo viable para entornos locales y demos. Contiene semillas para crear el usuario administrador inicial y proyectos/datos de prueba.

## Límites y Reglas Estrictas
- NUNCA se deben ejecutar estos seeders en un entorno de producción para insertar datos de prueba. 
- Solo el `admin-seed` debe estar preparado para ejecutarse condicionalmente si el sistema arranca por primera vez, garantizando un punto de entrada seguro.

## Anti-Patrones y Gotchas ⚠️
- Codificar contraseñas en texto plano en el repositorio (las semillas deben seguir el mismo flujo de hashing que el módulo de autenticación).
- Lanzar errores destructivos si la semilla ya se ejecutó; todas las inserciones deben ser idempotentes o verificar si el dato ya existe.

## Dependencias de Contexto Asumidas
- Asume conexión activa y configurada a la base de datos PostgreSQL vía TypeORM.

## Inputs / Outputs Esperados
- Ejecuta escrituras directas sobre la BBDD a través de los repositorios de dominio.

## Ejemplo de uso
Se invoca habitualmente en el hook `onApplicationBootstrap` del `SeedModule`:
```typescript
async onApplicationBootstrap() {
  if (this.config.get('SEED_DEMO_DATA') === 'true') {
    await this.demoSeedService.run();
  }
}
```

## Formato de Archivos
- `*.service.ts`: Servicios inyectables con métodos `run()` idempotentes.
