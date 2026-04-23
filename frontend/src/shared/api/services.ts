/**
 * Fachadas tipadas para consumir la API REST desde el frontend.
 *
 * Cada bloque agrupa endpoints por dominio y reutiliza la serialización de
 * filtros para evitar lógica duplicada en los paneles.
 */

import { http } from './http';
import type {
  AuthResponse,
  DeliveryEntity,
  DeliveryStatus,
  DownloadUrlResponse,
  PaginatedResponse,
  ProjectAssignmentEntity,
  ProjectEntity,
  ProjectProgressSummary,
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

  async progressSummary(projectId: string): Promise<ProjectProgressSummary> {
    const { data } = await http.get<ProjectProgressSummary>(
      `/projects/${projectId}/progress-summary`,
    );
    return data;
  },
};

export const assignmentsApi = {
  async bulkAssign(
    projectId: string,
    studentIds: string[],
  ): Promise<ProjectAssignmentEntity[]> {
    const { data } = await http.post<ProjectAssignmentEntity[]>(
      `/projects/${projectId}/assignments/bulk`,
      { studentIds },
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
