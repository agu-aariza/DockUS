/**
 * Fachadas tipadas para consumir la API REST desde el frontend.
 *
 * Cada bloque agrupa endpoints por dominio y reutiliza la serialización de
 * filtros para evitar lógica duplicada en los paneles.
 */

import { http } from './http';
import type {
  AuthResponse,
  BulkGroupEnrollResponse,
  BuilderOutcome,
  BulkAssignResponse,
  CourseGroupEntity,
  DeliveryEntity,
  DeliveryStatus,
  DownloadUrlResponse,
  GroupEnrollmentEntity,
  PaginatedResponse,
  ProjectAssignmentEntity,
  ProjectEntity,
  ProjectGradebookRow,
  ProjectOperationalIssuesReconcileResult,
  ProjectOperationalIssuesSummary,
  ProjectProgressSummary,
  ProjectRuntimeStatusResponse,
  ProjectStatus,
  StorageAssetRole,
  StorageObjectEntity,
  StorageScopeType,
  UserEntity,
  UserRole,
  UserStatus,
} from '../types';

function toParams(input: Record<string, string | number | undefined>): URLSearchParams {
  const params = new URLSearchParams();
  Object.entries(input).forEach(([key, value]) => {
    if (value === undefined) return;
    const normalized = String(value).trim();
    if (!normalized) return;
    params.set(key, normalized);
  });
  return params;
}

function normalizeStringArray(values?: string[]): string[] | undefined {
  if (!Array.isArray(values)) {
    return undefined;
  }

  const normalized = values
    .map((value) => value.trim())
    .filter(Boolean);

  return normalized.length > 0 ? normalized : undefined;
}

export const authApi = {
  async register(payload: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }): Promise<AuthResponse> {
    const { data } = await http.post<AuthResponse>('/auth/register', payload);
    return data;
  },

  async login(payload: { email: string; password: string }): Promise<AuthResponse> {
    const { data } = await http.post<AuthResponse>('/auth/login', payload);
    return data;
  },

  async profile(): Promise<{ userId: string; email: string; role: UserRole }> {
    const { data } = await http.get<{ userId: string; email: string; role: UserRole }>('/auth/profile');
    return data;
  },

  async refresh(refreshToken: string): Promise<AuthResponse> {
    const { data } = await http.post<AuthResponse>('/auth/refresh', { refreshToken });
    return data;
  },
};

export const usersApi = {
  async list(query: {
    page?: number;
    limit?: number;
    role?: UserRole;
    status?: UserStatus;
    search?: string;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  }): Promise<PaginatedResponse<UserEntity>> {
    const { data } = await http.get<PaginatedResponse<UserEntity>>('/users', {
      params: toParams(query),
    });
    return data;
  },

  async detail(id: string): Promise<UserEntity> {
    const { data } = await http.get<UserEntity>(`/users/${id}`);
    return data;
  },

  async create(payload: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role?: UserRole;
    status?: UserStatus;
  }): Promise<UserEntity> {
    const { data } = await http.post<UserEntity>('/users', payload);
    return data;
  },

  async update(
    id: string,
    payload: Partial<{
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      role: UserRole;
      status: UserStatus;
    }>,
  ): Promise<UserEntity> {
    const { data } = await http.patch<UserEntity>(`/users/${id}`, payload);
    return data;
  },

  async updateStatus(id: string, status: UserStatus): Promise<UserEntity> {
    const { data } = await http.patch<UserEntity>(`/users/${id}/status/${status}`);
    return data;
  },

  async remove(id: string): Promise<void> {
    await http.delete(`/users/${id}`);
  },

  async restore(id: string): Promise<UserEntity> {
    const { data } = await http.patch<UserEntity>(`/users/${id}/restore`);
    return data;
  },
};

export const projectsApi = {
  async list(query: {
    page?: number;
    limit?: number;
    status?: ProjectStatus;
    creatorId?: string;
    search?: string;
    createdFrom?: string;
    createdTo?: string;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  }): Promise<PaginatedResponse<ProjectEntity>> {
    const { data } = await http.get<PaginatedResponse<ProjectEntity>>('/projects', {
      params: toParams(query),
    });
    return data;
  },

  async detail(id: string): Promise<ProjectEntity> {
    const { data } = await http.get<ProjectEntity>(`/projects/${id}`);
    return data;
  },

  async create(payload: {
    title: string;
    contextAcademico?: string;
    status?: ProjectStatus;
    maxDeliveriesPerStudent?: number;
    expectedType?: string;
    rubricInstructions?: string;
    opensAt?: string;
    closesAt?: string;
  }): Promise<ProjectEntity> {
    const { data } = await http.post<ProjectEntity>('/projects', payload);
    return data;
  },

  async update(
    id: string,
    payload: Partial<{
      title: string;
      contextAcademico: string;
      status: ProjectStatus;
      maxDeliveriesPerStudent: number;
      expectedType: string;
      rubricInstructions: string;
      opensAt: string;
      closesAt: string;
    }>,
  ): Promise<ProjectEntity> {
    const { data } = await http.patch<ProjectEntity>(`/projects/${id}`, payload);
    return data;
  },

  async updateStatus(id: string, status: ProjectStatus): Promise<ProjectEntity> {
    const { data } = await http.patch<ProjectEntity>(`/projects/${id}/status/${status}`);
    return data;
  },

  async remove(id: string): Promise<void> {
    await http.delete(`/projects/${id}`);
  },

  async restore(id: string): Promise<ProjectEntity> {
    const { data } = await http.patch<ProjectEntity>(`/projects/${id}/restore`);
    return data;
  },

  async uploadTestSuite(projectId: string, file: File): Promise<StorageObjectEntity> {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await http.post<StorageObjectEntity>(
      `/projects/${projectId}/test-suite/upload`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      },
    );
    return data;
  },

  async getTestSuite(projectId: string): Promise<StorageObjectEntity> {
    const { data } = await http.get<StorageObjectEntity>(
      `/projects/${projectId}/test-suite`,
    );
    return data;
  },

  async removeTestSuite(projectId: string): Promise<{ message: string }> {
    const { data } = await http.delete<{ message: string }>(
      `/projects/${projectId}/test-suite`,
    );
    return data;
  },

  async progressSummary(
    projectId: string,
    query?: {
      deliveryStatus?: DeliveryStatus;
      builderOutcome?: BuilderOutcome;
      lateOnly?: boolean;
      groupId?: string;
    },
  ): Promise<ProjectProgressSummary> {
    const { data } = await http.get<ProjectProgressSummary>(
      `/projects/${projectId}/progress-summary`,
      {
        params: toParams({
          deliveryStatus: query?.deliveryStatus,
          builderOutcome: query?.builderOutcome,
          lateOnly: query?.lateOnly ? "true" : undefined,
          groupId: query?.groupId,
        }),
      },
    );
    return data;
  },

  async gradebook(
    projectId: string,
    query?: {
      deliveryStatus?: DeliveryStatus;
      builderOutcome?: BuilderOutcome;
      lateOnly?: boolean;
      groupId?: string;
    },
  ): Promise<ProjectGradebookRow[]> {
    const { data } = await http.get<ProjectGradebookRow[]>(
      `/projects/${projectId}/gradebook`,
      {
        params: toParams({
          deliveryStatus: query?.deliveryStatus,
          builderOutcome: query?.builderOutcome,
          lateOnly: query?.lateOnly ? "true" : undefined,
          groupId: query?.groupId,
        }),
      },
    );
    return data;
  },

  async operationalIssues(): Promise<ProjectOperationalIssuesSummary> {
    const { data } = await http.get<ProjectOperationalIssuesSummary>(
      "/projects/operational-issues",
    );
    return data;
  },

  async reconcileOperationalIssues(payload: {
    mode?: "dry-run" | "apply";
    categories?: Array<
      "orphanAssignments" | "orphanDeliveries" | "orphanStorageObjects"
    >;
  }): Promise<ProjectOperationalIssuesReconcileResult> {
    const { data } = await http.post<ProjectOperationalIssuesReconcileResult>(
      "/projects/operational-issues/reconcile",
      payload,
    );
    return data;
  },

  async exportProgressSummary(
    projectId: string,
    query?: {
      deliveryStatus?: DeliveryStatus;
      builderOutcome?: BuilderOutcome;
      lateOnly?: boolean;
      groupId?: string;
    },
  ): Promise<Blob> {
    const response = await http.get(`/projects/${projectId}/progress-summary/export`, {
      params: toParams({
        deliveryStatus: query?.deliveryStatus,
        builderOutcome: query?.builderOutcome,
        lateOnly: query?.lateOnly ? "true" : undefined,
        groupId: query?.groupId,
      }),
      responseType: "blob",
    });
    return response.data as Blob;
  },

  async exportGradebook(
    projectId: string,
    query?: {
      deliveryStatus?: DeliveryStatus;
      builderOutcome?: BuilderOutcome;
      lateOnly?: boolean;
      groupId?: string;
    },
  ): Promise<Blob> {
    const response = await http.get(`/projects/${projectId}/gradebook/export`, {
      params: toParams({
        deliveryStatus: query?.deliveryStatus,
        builderOutcome: query?.builderOutcome,
        lateOnly: query?.lateOnly ? "true" : undefined,
        groupId: query?.groupId,
      }),
      responseType: "blob",
    });
    return response.data as Blob;
  },

  async runtime(projectId: string): Promise<ProjectRuntimeStatusResponse> {
    const { data } = await http.get<ProjectRuntimeStatusResponse>(
      `/projects/${projectId}/runtime`,
    );
    return data;
  },

  async reconcileRuntime(projectId: string): Promise<ProjectEntity> {
    const { data } = await http.post<ProjectEntity>(
      `/projects/${projectId}/runtime/reconcile`,
    );
    return data;
  },
};

export const assignmentsApi = {
  async bulkAssign(
    projectId: string,
    payload: {
      studentIds?: string[];
      studentEmails?: string[];
      groupIds?: string[];
    },
  ): Promise<BulkAssignResponse> {
    const sanitizedPayload = {
      studentIds: normalizeStringArray(payload.studentIds),
      studentEmails: normalizeStringArray(payload.studentEmails),
      groupIds: normalizeStringArray(payload.groupIds),
    };
    const { data } = await http.post<BulkAssignResponse>(
      `/projects/${projectId}/assignments/bulk`,
      sanitizedPayload,
    );
    return data;
  },

  async listByProject(projectId: string): Promise<ProjectAssignmentEntity[]> {
    const { data } = await http.get<ProjectAssignmentEntity[]>(
      `/projects/${projectId}/assignments`,
    );
    return data;
  },

  async listMine(): Promise<ProjectAssignmentEntity[]> {
    const { data } = await http.get<ProjectAssignmentEntity[]>('/assignments/me');
    return data;
  },

  async revoke(assignmentId: string): Promise<{ message: string }> {
    const { data } = await http.delete<{ message: string }>(
      `/assignments/${assignmentId}`,
    );
    return data;
  },
};

export const groupsApi = {
  async list(): Promise<CourseGroupEntity[]> {
    const { data } = await http.get<CourseGroupEntity[]>('/groups');
    return data;
  },

  async create(payload: {
    name: string;
    code?: string;
    description?: string;
  }): Promise<CourseGroupEntity> {
    const { data } = await http.post<CourseGroupEntity>('/groups', payload);
    return data;
  },

  async listEnrollments(groupId: string): Promise<GroupEnrollmentEntity[]> {
    const { data } = await http.get<GroupEnrollmentEntity[]>(
      `/groups/${groupId}/enrollments`,
    );
    return data;
  },

  async bulkEnroll(
    groupId: string,
    payload: {
      studentIds?: string[];
      studentEmails?: string[];
    },
  ): Promise<BulkGroupEnrollResponse> {
    const sanitizedPayload = {
      studentIds: normalizeStringArray(payload.studentIds),
      studentEmails: normalizeStringArray(payload.studentEmails),
    };
    const { data } = await http.post<BulkGroupEnrollResponse>(
      `/groups/${groupId}/enrollments/bulk`,
      sanitizedPayload,
    );
    return data;
  },

  async revokeEnrollment(enrollmentId: string): Promise<{ message: string }> {
    const { data } = await http.delete<{ message: string }>(
      `/groups/enrollments/${enrollmentId}`,
    );
    return data;
  },
};

export const deliveriesApi = {
  async list(query: {
    page?: number;
    limit?: number;
    projectId?: string;
    assignmentId?: string;
    authorId?: string;
    status?: DeliveryStatus;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  }): Promise<PaginatedResponse<DeliveryEntity>> {
    const { data } = await http.get<PaginatedResponse<DeliveryEntity>>('/deliveries', {
      params: toParams(query),
    });
    return data;
  },

  async detail(id: string): Promise<DeliveryEntity> {
    const { data } = await http.get<DeliveryEntity>(`/deliveries/${id}`);
    return data;
  },

  async create(payload: {
    assignmentId: string;
    status?: DeliveryStatus;
    notes?: string;
  }): Promise<DeliveryEntity> {
    const { data } = await http.post<DeliveryEntity>('/deliveries', payload);
    return data;
  },

  async update(
    id: string,
    payload: Partial<{
      assignmentId: string;
      status: DeliveryStatus;
      notes: string;
    }>,
  ): Promise<DeliveryEntity> {
    const { data } = await http.patch<DeliveryEntity>(`/deliveries/${id}`, payload);
    return data;
  },

  async updateStatus(id: string, status: DeliveryStatus): Promise<DeliveryEntity> {
    const { data } = await http.patch<DeliveryEntity>(`/deliveries/${id}/status/${status}`);
    return data;
  },

  async updateGrading(
    id: string,
    payload: Partial<{
      grade: number | null;
      graderNotes: string;
    }>,
  ): Promise<DeliveryEntity> {
    const { data } = await http.patch<DeliveryEntity>(
      `/deliveries/${id}/grading`,
      payload,
    );
    return data;
  },

  async remove(id: string): Promise<void> {
    await http.delete(`/deliveries/${id}`);
  },

  async restore(id: string): Promise<DeliveryEntity> {
    const { data } = await http.patch<DeliveryEntity>(`/deliveries/${id}/restore`);
    return data;
  },
};

export const storageApi = {
  async list(query: {
    page?: number;
    limit?: number;
    deliveryId?: string;
    projectId?: string;
    scopeType?: StorageScopeType;
    assetRole?: StorageAssetRole;
    uploaderId?: string;
    createdFrom?: string;
    createdTo?: string;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  }): Promise<PaginatedResponse<StorageObjectEntity>> {
    const { data } = await http.get<PaginatedResponse<StorageObjectEntity>>('/storage', {
      params: toParams(query),
    });
    return data;
  },

  async detail(id: string): Promise<StorageObjectEntity> {
    const { data } = await http.get<StorageObjectEntity>(`/storage/${id}`);
    return data;
  },

  async upload(input: {
    deliveryId: string;
    logicalName: string;
    logicalPath: string;
    contentType: string;
    hash: string;
    file: File;
    sizeBytes?: number;
  }): Promise<StorageObjectEntity> {
    const formData = new FormData();
    formData.append('deliveryId', input.deliveryId);
    formData.append('logicalName', input.logicalName);
    formData.append('logicalPath', input.logicalPath);
    formData.append('contentType', input.contentType);
    formData.append('hash', input.hash);
    if (typeof input.sizeBytes === 'number') {
      formData.append('sizeBytes', String(input.sizeBytes));
    }
    formData.append('file', input.file);

    const { data } = await http.post<StorageObjectEntity>('/storage/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return data;
  },

  async createDownloadUrl(id: string): Promise<DownloadUrlResponse> {
    const { data } = await http.post<DownloadUrlResponse>(`/storage/${id}/download-url`);
    return data;
  },

  async remove(id: string): Promise<void> {
    await http.delete(`/storage/${id}`);
  },

  async purge(id: string): Promise<void> {
    await http.delete(`/storage/${id}/purge`);
  },

  async restore(id: string): Promise<StorageObjectEntity> {
    const { data } = await http.patch<StorageObjectEntity>(`/storage/${id}/restore`);
    return data;
  },
};
