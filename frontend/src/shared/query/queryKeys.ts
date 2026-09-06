/**
 * @fileoverview Factoría centralizada de query keys de React Query (queryKeys).
 *
 * @module queryKeys
 */

export const queryKeys = {
  deliveries: {
    all: ['deliveries'] as const,
    list: (assignmentId: string) => ['deliveries', 'list', assignmentId] as const,
    // Vista del propio alumno: todas sus entregas, sin filtrar por asignación
    // (el backend ya alcanza por el usuario autenticado) — key distinta de
    // list(assignmentId), que siempre exige una asignación. Soporta namespace opcional por usuario.
    mine: (userId?: string) =>
      userId ? (['deliveries', 'mine', userId] as const) : (['deliveries', 'mine'] as const),
    latestRuns: (evaluatedIds: string[]) =>
      ['deliveries', 'latestRuns', [...evaluatedIds].sort()] as const,
    preview: (deliveryId: string) => ['deliveries', 'preview', deliveryId] as const,
  },
  projects: {
    all: ['projects'] as const,
    list: () => ['projects', 'list'] as const,
    testSuite: (projectId: string) => ['projects', 'testSuite', projectId] as const,
    // Lista ligera (page:1,limit:50, sin orden) para pickers rápidos —
    // compartida entre WorkspaceBar y CommandPalette, que hacen exactamente
    // esta misma llamada; distinta de list() (con sortBy/sortOrder) y de
    // storage.projectsFilter() (limit:100).
    picker: () => ['projects', 'picker'] as const,
    // Compartida entre CohortAnalyticsDashboard (sin groupId) y
    // ProgressDashboard (con groupId opcional) — mismo endpoint, mismo
    // contrato; groupId ausente se normaliza a null para que "sin filtro de
    // grupo" sea la misma entrada de caché la pida quien la pida.
    progressSummary: (projectId: string, groupId?: string) =>
      ['projects', 'progressSummary', projectId, groupId ?? null] as const,
    gradebook: (projectId: string, groupId?: string) =>
      ['projects', 'gradebook', projectId, groupId ?? null] as const,
    qualityInsights: (projectId: string) => ['projects', 'qualityInsights', projectId] as const,
    qualityInsightsByCategory: (projectId: string, category: string) =>
      ['projects', 'qualityInsights', projectId, 'category', category] as const,
    qualityInsightsForStudent: (projectId: string, studentId: string) =>
      ['projects', 'qualityInsights', projectId, 'student', studentId] as const,
  },
  assignments: {
    all: ['assignments'] as const,
    mine: (userId?: string) =>
      userId ? (['assignments', 'mine', userId] as const) : (['assignments', 'mine'] as const),
    byProject: (projectId: string) => ['assignments', 'byProject', projectId] as const,
  },
  groups: {
    all: ['groups'] as const,
    list: () => ['groups', 'list'] as const,
    enrollments: (groupId: string) => ['groups', 'enrollments', groupId] as const,
  },
  users: {
    all: ['users'] as const,
    list: (query: Record<string, unknown>) => ['users', 'list', query] as const,
  },
  storage: {
    all: ['storage'] as const,
    list: (query: Record<string, unknown>) => ['storage', 'list', query] as const,
    // Key propia (no queryKeys.projects.list()): esta llamada usa params distintos
    // (limit:100, sin paginación/orden), así que compartir la key de la lista
    // paginada de proyectos causaría que ambas queries pisaran la misma entrada
    // de caché con formas de respuesta distintas.
    projectsFilter: () => ['storage', 'filters', 'projects'] as const,
    deliveriesFilter: (projectId: string) => ['storage', 'filters', 'deliveries', projectId] as const,
    runsFilter: (deliveryId: string) => ['storage', 'filters', 'runs', deliveryId] as const,
  },
  llmConfig: {
    all: () => ['llm', 'configs'] as const,
  },
  studentProfile: {
    byId: (studentId: string) => ['students', 'profile', studentId] as const,
    mine: () => ['students', 'profile', 'mine'] as const,
  },
  builderChat: {
    messages: (buildRunId: string) => ['builder', 'chatMessages', buildRunId] as const,
  },
  builderRuns: {
    all: ['builder'] as const,
    // Reconstrucción del log completo drenando todas las páginas de eventos
    // — operación única de cara a la UI (no hay "cargar más"), de ahí un
    // useQuery normal con un queryFn que pagina por dentro, no useInfiniteQuery.
    logs: (buildRunId: string) => ['builder', 'runLogs', buildRunId] as const,
    // Proyección autorizada del informe v3 del run.
    reportV3: (buildRunId: string, mode?: string) =>
      ['builder', 'reportV3', buildRunId, mode ?? 'default'] as const,
  },
  health: {
    readiness: () => ['health', 'readiness'] as const,
  },
  commandPalette: {
    // Dataset derivado propio (proyectos + sus asignaciones, aplanado y
    // enriquecido) — no es la misma forma que ninguna otra query de proyectos
    // o asignaciones, de ahí una key dedicada en vez de reusar esas.
    assignments: () => ['commandPalette', 'assignments'] as const,
  },
  runtime: {
    // limit:20 (con paginación en la UI), distinto de deliveries.latestRuns()
    // y de storage.runsFilter() (limit:100, sin paginar) — key propia.
    runsByDelivery: (deliveryId: string) => ['runtime', 'runsByDelivery', deliveryId] as const,
  },
  workspaceBar: {
    // Params sin paginar/ordenar, distintos de deliveries.list()/storage.runsFilter().
    deliveryPicker: (projectId: string, assignmentId: string) =>
      ['workspaceBar', 'deliveryPicker', projectId, assignmentId] as const,
    runPicker: (deliveryId: string) => ['workspaceBar', 'runPicker', deliveryId] as const,
  },
  // Vistas de resumen/dashboard: previews acotados (limit bajo, params fijos)
  // que no son la misma query que las listas paginadas de sus dominios —
  // de ahí keys propias en vez de reusar projects.list()/deliveries.list().
  summary: {
    all: ['summary'] as const,
    recentProjects: () => ['summary', 'recentProjects'] as const,
    pendingDeliveries: () => ['summary', 'pendingDeliveries'] as const,
    recentEvaluated: () => ['summary', 'recentEvaluated'] as const,
    studentsCount: () => ['summary', 'studentsCount'] as const,
    operationalIssues: () => ['summary', 'operationalIssues'] as const,
  },
} as const;
