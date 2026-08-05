/**
 * @fileoverview Restringe una query de `StorageObject` a lo visible por el actor.
 *
 * Contexto:
 * - La lógica se mantiene en este helper porque la consulta del repositorio
 *   necesita aplicar el alcance del actor sin exponer el query builder al puerto.
 * `queryBuilder` que ella misma construía; al absorber esa consulta
 * completa en `StorageObjectRepository.findPaginated`, el scoping se mueve
 * con ella. Cero cambio de comportamiento: mismo cuerpo de función,
 * reubicado.
 * - Requiere que el `queryBuilder` ya tenga los joins `storage.project` como
 * `project` y `storage.delivery` como `delivery` (los añade
 * `findPaginated` antes de llamar a esta función).
 *
 * @module StorageActorScopeUtil
 */

import { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../../../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../../../users/entities/user.entity';
import {
  StorageAssetRole,
  StorageObject,
} from '../../storage/entities/storage-object.entity';

export function applyStorageActorScope(
  queryBuilder: ReturnType<Repository<StorageObject>['createQueryBuilder']>,
  actor: AuthenticatedUser,
): void {
  if (actor.role === UserRole.ADMIN) {
    return;
  }

  if (actor.role === UserRole.STUDENT) {
    queryBuilder
      .andWhere('storage.assetRole = :studentSourceRole', {
        studentSourceRole: StorageAssetRole.STUDENT_SOURCE,
      })
      .andWhere('delivery.authorId = :requestUserId', {
        requestUserId: actor.userId,
      });
    return;
  }

  queryBuilder
    .innerJoin('project.teachers', 'teacher')
    .andWhere('teacher.id = :requestUserId', {
      requestUserId: actor.userId,
    });
}
