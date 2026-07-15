/**
 * Fachada de compatibilidad para consumir la API REST desde el frontend.
 *
 * La implementación real vive ahora en módulos por dominio para mantener los
 * contratos cerca de cada responsabilidad y reducir el tamaño del agregado.
 */

export { authApi } from "./authApi";
export { usersApi } from "./usersApi";
export { projectsApi } from "./projectsApi";
export { assignmentsApi } from "./assignmentsApi";
export { groupsApi } from "./groupsApi";
export { deliveriesApi } from "./deliveriesApi";
export { storageApi } from "./storageApi";
export { builderApi } from "./builderApi";
export { llmApi } from "./llmApi";
export { studentsApi } from "./studentsApi";
export { healthApi } from "./healthApi";
