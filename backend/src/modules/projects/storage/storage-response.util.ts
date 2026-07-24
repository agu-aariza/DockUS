/**
 * @fileoverview Módulo de proyectos académicos y entregas (storage-response.util).
 *
 * @module storage-response.util
 */

import { StorageObject } from './entities/storage-object.entity';
import { StorageObjectResponse } from './storage.types';

export function toStorageObjectResponse(
  storageObject: StorageObject,
): StorageObjectResponse {
  let projectName: string | undefined = undefined;
  let deliveryVersion: number | undefined = undefined;
  let studentName: string | undefined = undefined;

  if (storageObject.project) {
    projectName = storageObject.project.title;
  } else if (storageObject.delivery) {
    if (storageObject.delivery.assignment?.project) {
      projectName = storageObject.delivery.assignment.project.title;
    }
    deliveryVersion = storageObject.delivery.version;
    if (storageObject.delivery.author) {
      studentName = `${storageObject.delivery.author.firstName} ${storageObject.delivery.author.lastName}`;
    }
  }

  return {
    id: storageObject.id,
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
    projectName,
    deliveryVersion,
    studentName,
  };
}
