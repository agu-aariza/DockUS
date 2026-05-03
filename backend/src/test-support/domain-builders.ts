import type { AuthenticatedUser } from '../modules/auth/interfaces/authenticated-user.interface';
import { UserRole } from '../modules/users/entities/user.entity';
import {
  Project,
  ProjectRuntimeEnvironmentStatus,
  ProjectStatus,
} from '../modules/projects/entities/project.entity';
import { ProjectAssignment } from '../modules/projects/assignments/entities/project-assignment.entity';
import {
  Delivery,
  DeliveryStatus,
} from '../modules/projects/deliveries/entities/delivery.entity';
import {
  StorageAssetRole,
  StorageObject,
  StorageScopeType,
} from '../modules/projects/storage/entities/storage-object.entity';
import type { UploadedStorageFile } from '../modules/projects/storage/interfaces/uploaded-storage-file.interface';
import type { MinioStorageService } from '../shared/infrastructure/storage/minio-storage.service';

export function buildActor(
  role: UserRole,
  userId = '11111111-1111-1111-1111-111111111111',
): AuthenticatedUser {
  return {
    userId,
    email: `${role.toLowerCase()}@dockus.test`,
    role,
  };
}

export function buildProject(overrides: Partial<Project> = {}): Project {
  return {
    id: '5a6f2626-c78c-4842-b180-f1ca0a3f2d53',
    title: 'Proyecto base',
    contextAcademico: 'MPSP',
    status: ProjectStatus.ACTIVE,
    creatorId: '22222222-2222-2222-2222-222222222222',
    maxDeliveriesPerStudent: 2,
    expectedType: 'PYTHON_FASTAPI',
    rubricInstructions: 'Evaluar calidad de código y tests.',
    runtimeNetworkName: null,
    runtimeEnvironmentStatus: ProjectRuntimeEnvironmentStatus.ABSENT,
    runtimeProvisionedAt: null,
    runtimeLastError: null,
    opensAt: null,
    closesAt: null,
    creator: null as unknown as Project['creator'],
    teachers: [] as Project['teachers'],
    createdAt: new Date('2026-03-09T00:00:00.000Z'),
    updatedAt: new Date('2026-03-09T00:00:00.000Z'),
    deletedAt: null as unknown as Project['deletedAt'],
    ...overrides,
  };
}

export function buildAssignment(
  overrides: Partial<ProjectAssignment> = {},
): ProjectAssignment {
  return {
    id: '33333333-3333-3333-3333-333333333333',
    projectId: '5a6f2626-c78c-4842-b180-f1ca0a3f2d53',
    project: buildProject(),
    studentId: '44444444-4444-4444-4444-444444444444',
    student: {
      id: '44444444-4444-4444-4444-444444444444',
      email: 'student@dockus.test',
      firstName: 'Dock',
      lastName: 'Student',
    } as ProjectAssignment['student'],
    assignedById: '22222222-2222-2222-2222-222222222222',
    assignedBy: null as unknown as ProjectAssignment['assignedBy'],
    assignedAt: new Date('2026-03-01T00:00:00.000Z'),
    updatedAt: new Date('2026-03-01T00:00:00.000Z'),
    revokedAt: null,
    sourceGroupIds: [],
    ...overrides,
  };
}

export function buildDelivery(overrides: Partial<Delivery> = {}): Delivery {
  return {
    id: '55555555-5555-5555-5555-555555555555',
    assignmentId: '33333333-3333-3333-3333-333333333333',
    assignment: buildAssignment(),
    authorId: '44444444-4444-4444-4444-444444444444',
    author: undefined as unknown as Delivery['author'],
    version: 1,
    status: DeliveryStatus.DRAFT,
    notes: 'Entrega inicial',
    isLate: false,
    grade: null,
    graderNotes: null,
    createdAt: new Date('2026-03-09T00:00:00.000Z'),
    updatedAt: new Date('2026-03-09T00:00:00.000Z'),
    deletedAt: null as unknown as Delivery['deletedAt'],
    ...overrides,
  };
}

export function buildStorageObject(
  overrides: Partial<StorageObject> = {},
): StorageObject {
  return {
    id: '66666666-6666-6666-6666-666666666666',
    scopeType: StorageScopeType.DELIVERY,
    scopeId: '55555555-5555-5555-5555-555555555555',
    assetRole: StorageAssetRole.STUDENT_SOURCE,
    projectId: '5a6f2626-c78c-4842-b180-f1ca0a3f2d53',
    project: null,
    deliveryId: '55555555-5555-5555-5555-555555555555',
    delivery: null,
    logicalName: 'main.py',
    logicalPath: 'src/main.py',
    contentType: 'text/x-python',
    sizeBytes: 10,
    hash: 'abc123',
    bucket: 'dockus-storage',
    objectKey:
      'deliveries/55555555-5555-5555-5555-555555555555/student-source/main.py',
    uploaderId: '11111111-1111-1111-1111-111111111111',
    uploader: undefined as unknown as StorageObject['uploader'],
    createdAt: new Date('2026-03-09T00:00:00.000Z'),
    updatedAt: new Date('2026-03-09T00:00:00.000Z'),
    deletedAt: null as unknown as StorageObject['deletedAt'],
    ...overrides,
  };
}

export function buildUploadedStorageFile(
  overrides: Partial<UploadedStorageFile> = {},
): UploadedStorageFile {
  return {
    buffer: Buffer.alloc(1),
    size: 1,
    ...overrides,
  };
}

export function createMinioStorageServiceMock(): {
  createDownloadSignedUrl: jest.MockedFunction<
    MinioStorageService['createDownloadSignedUrl']
  >;
  deleteObject: jest.MockedFunction<MinioStorageService['deleteObject']>;
  getBucketName: jest.MockedFunction<MinioStorageService['getBucketName']>;
  getSignedUrlTtlSeconds: jest.MockedFunction<
    MinioStorageService['getSignedUrlTtlSeconds']
  >;
  objectExists: jest.MockedFunction<MinioStorageService['objectExists']>;
  putObject: jest.MockedFunction<MinioStorageService['putObject']>;
} {
  return {
    createDownloadSignedUrl: jest.fn(),
    deleteObject: jest.fn(),
    getBucketName: jest.fn(),
    getSignedUrlTtlSeconds: jest.fn(),
    objectExists: jest.fn(),
    putObject: jest.fn(),
  };
}
