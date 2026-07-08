## Responsabilidad del Módulo
Gestiona la administración y visualización de archivos de almacenamiento, permitiendo navegar y operar con objetos en S3/MinIO desde el panel de control del profesor o administrador.

## Lo que este módulo NO hace (Anti-Goals) ⚠️
No gestiona la carga de archivos de entregas de estudiantes directamente. Solo proporciona una interfaz genérica de administración de buckets/objetos.

## Conceptos Clave (Glosario)
- **StoragePanel**: Interfaz principal para explorar y administrar el almacenamiento.
- **StorageObject**: Entidad que representa un archivo o directorio en el bucket.

## Dependencias Externas Clave
Depende de `shared/api/storageApi.ts` y componentes de la UI base desde `shared/components/ui`.

## Efectos Secundarios (Side Effects)
Realiza llamadas directas para mutar archivos en el almacenamiento remoto a través del API.

## Estado / BBDD
Maneja el estado local de navegación (directorios actuales, selección de archivos) y de carga de elementos de almacenamiento en el cliente.

## Puntos de Entrada (Entrypoints)
- `StoragePanel.tsx`
