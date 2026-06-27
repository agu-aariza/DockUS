# Module: Users

## Descripción General
El módulo `UsersModule` es el núcleo de identidad del backend de DockUS. Se encarga de la gestión y persistencia de identidades (usuarios), así como de la autorización base mediante roles (Role-Based Access Control - RBAC) y control de estados de cuenta. 
Su diseño permite operaciones administrativas seguras (CRUD) y provee una abstracción interna para que el módulo de Autenticación (`AuthModule`) verifique las credenciales sin exponer secretos o contraseñas al resto del sistema.

## Árbol de Directorios
```text
users/
├── README.md
├── users.controller.ts
├── users.module.ts
├── users.service.spec.ts
├── users.service.ts
├── dto/
│   ├── create-user.dto.ts
│   ├── list-users-query.dto.ts
│   └── user-response.dto.ts
└── entities/
    └── user.entity.ts
```

## Detalle Exhaustivo de Ficheros

### 1. Entidades de Dominio
- **`entities/user.entity.ts`**
  - **Propósito:** Definir el esquema de la base de datos para la tabla `users` usando TypeORM.
  - **Responsabilidad:** Modela la información del usuario (`id` en formato UUID v4, `email`, `firstName`, `lastName`). Gestiona la seguridad declarando `passwordHash` con `select: false` para evitar fugas. Define la jerarquía de roles (`UserRole`: STUDENT, TEACHER, ADMIN) y el ciclo de vida de la cuenta (`UserStatus`: ACTIVE, INACTIVE, SUSPENDED, PENDING_VERIFICATION). También integra campos de auditoría (`createdAt`, `updatedAt`, y `deletedAt` para Soft Deletes) y relaciones (ej. con la entidad `Project`).
  - **Conexiones:** Es la fuente de la verdad para cualquier consulta a la base de datos sobre usuarios. Se usa a lo largo de todo este módulo y por otros módulos como `Academic` a través de relaciones.

### 2. Capa de Lógica de Negocio
- **`users.service.ts`**
  - **Propósito:** Contener la lógica de negocio y las operaciones directas contra la base de datos.
  - **Responsabilidad:** 
    - Implementar alta de usuarios con cifrado seguro (hash) usando `bcrypt` (`BCRYPT_SALT_ROUNDS = 10`).
    - Validar duplicados de email mediante el utilitario global de violaciones únicas (Unique Violation).
    - Exponer métodos de consulta especializados: `findByEmail` (seguro, sin password), `findByEmailForAuth` (inseguro, usado solo internamente por `AuthModule` para validar contraseñas) y paginación avanzada (`findAll`) respetando filtros (`status`, `role`) y ordenamientos seguros.
    - Implementar borrado lógico (`softRemove` / `restore`) y cambios de estado operativo de la cuenta (`updateStatus`).
  - **Conexiones:** Injecta el repositorio TypeORM de `User`. Es exportado por el módulo y consumido primariamente por `AuthModule` para el login, y por el `UsersController` para el panel administrativo.

- **`users.service.spec.ts`**
  - **Propósito:** Tests unitarios de la capa de servicio.
  - **Responsabilidad:** Verificar exhaustivamente los flujos del `users.service.ts`, validando el hash de contraseñas, la captura de excepciones TypeORM para violaciones de unicidad, y el paginado/sanitizado correcto de respuestas.

### 3. Capa de Transporte (Controladores)
- **`users.controller.ts`**
  - **Propósito:** Exponer las APIs RESTful de administración de usuarios.
  - **Responsabilidad:** Mapea rutas (ej. `GET /users`, `POST /users`, `PATCH /users/:id`, `DELETE /users/:id`). Asegura todos los endpoints utilizando `UseGuards(JwtAuthGuard, RolesGuard)` para restringir su uso según roles (generalmente solo `ADMIN` y `TEACHER` para lectura). Decora exhaustivamente cada endpoint con `@ApiResponse` y `@ApiOperation` de Swagger para generar documentación de API precisa. Llama a `users.service.ts` tras pasar las validaciones.
  - **Conexiones:** Es el punto de entrada HTTP desde clientes de administración (como el frontend) hacia la lógica de identidades.

### 4. Objetos de Transferencia de Datos (DTOs)
- **`dto/create-user.dto.ts`**
  - **Propósito:** Validar payload de creación y actualización (mediante `PartialType`).
  - **Responsabilidad:** Usando `class-validator`, impone estrictas reglas de negocio: contraseñas seguras (mínimo 8 caracteres, mayúscula, número/especial, usando `@Matches`), formato de email (`@IsEmail`), y enumeraciones limitadas (`UserRole`, `UserStatus`).
- **`dto/list-users-query.dto.ts`**
  - **Propósito:** Validar el querystring en búsquedas (GET).
  - **Responsabilidad:** Prevenir ataques de SQL/NoSQL Injection limitando los campos permitidos para el orden (`USER_SORT_FIELDS`). Gestiona la paginación (`page`, `limit`) y los filtros opcionales.
- **`dto/user-response.dto.ts`**
  - **Propósito:** Estructurar de manera estricta la respuesta, ocultando metadatos indeseados de TypeORM y asegurando que las fechas (ISO string) y estructura paginada sean uniformes y tipadas para Swagger.

### 5. Configuración de Módulo
- **`users.module.ts`**
  - **Propósito:** Contenedor de Inyección de Dependencias para el dominio Users.
  - **Responsabilidad:** Registra el controlador y el servicio. Importa el modelo de persistencia `TypeOrmModule.forFeature([User])`. Es vital notar que exporta `UsersService` para que el sistema de autenticación (`AuthModule`) pueda invocar métodos como `findByEmailForAuth`.
  - **Conexiones:** Se importa en el archivo raíz de la aplicación (`AppModule`).

## Información Crítica para IA
- **Seguridad (Zero-Trust):** La entidad `User` tiene el campo `passwordHash` configurado con `select: false`. Esto asegura que por defecto las consultas a BD (incluyendo `.find()`) omitan el hash de contraseñas, minimizando el riesgo de exposición en logs o respuestas HTTP por descuido.
- **Acoplamiento Restringido:** El único módulo con permiso explícito para usar `findByEmailForAuth` y llamar a `.passwordHash` es el `AuthModule`. Se deben utilizar los DTOs definidos para cualquier entrada o salida de datos; nunca se debe pasar el modelo de datos crudo (`User`) como respuesta HTTP sin pasarlo antes por `sanitizeUser()`.
