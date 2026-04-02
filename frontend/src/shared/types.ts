export type UserRole = 'ADMIN' | 'TEACHER' | 'STUDENT';
export type UserStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'SUSPENDED'
  | 'PENDING_VERIFICATION';
export type ProjectStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type DeliveryStatus = 'DRAFT' | 'SUBMITTED' | 'IN_REVIEW' | 'EVALUATED';

export interface ApiErrorPayload {
  message: string | string[];
  error?: string;
  statusCode?: number;
}

export interface PaginatedMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginatedMeta;
}

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
}

export interface SessionRecord {
  id: string;
  label: string;
  userId: string;
  email: string;
  role: UserRole;
  accessToken: string;
  createdAt: string;
}

export interface UserEntity {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface ProjectEntity {
  id: string;
  title: string;
  contextAcademico: string | null;
  status: ProjectStatus;
  creatorId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface DeliveryEntity {
  id: string;
  projectId: string;
  authorId: string;
  version: number;
  status: DeliveryStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface StorageObjectEntity {
  id: string;
  deliveryId: string;
  logicalName: string;
  logicalPath: string;
  contentType: string;
  sizeBytes: number;
  hash: string;
  createdAt: string;
  uploaderId: string;
}

export interface DownloadUrlResponse {
  downloadUrl: string;
  expiresAt: string;
}
