import { StorageObject } from './entities/storage-object.entity';
import { StorageObjectResponse } from './storage.types';

export function toStorageObjectResponse(
  storageObject: StorageObject,
): StorageObjectResponse {
  return {
    id: storageObject.id,
    scopeType: storageObject.scopeType,
    scopeId: storageObject.scopeId,
    assetRole: storageObject.assetRole,
    projectId: storageObject.projectId,
    deliveryId: storageObject.deliveryId,
    logicalName: storageObject.logicalName,
    logicalPath: storageObject.logicalPath,
    contentType: storageObject.contentType,
    sizeBytes: storageObject.sizeBytes,
    hash: storageObject.hash,
    createdAt: storageObject.createdAt.toISOString(),
    uploaderId: storageObject.uploaderId,
  };
}
