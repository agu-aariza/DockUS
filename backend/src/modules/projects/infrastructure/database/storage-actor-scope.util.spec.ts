/**
 * @fileoverview Pruebas unitarias del scoping de `StorageObject` por actor.
 *
 * Contexto:
 * - Cubre `applyStorageActorScope`, absorbida en el adaptador desde
 *   `StorageAccessService.applyActorScope` (plan_accion.md P2-6). No existía
 *   cobertura previa de este método — se añade aquí, no se mueve.
 *
 * @module StorageActorScopeUtilSpec
 */

import { buildActor } from '../../../../test-support/domain-builders';
import { UserRole } from '../../../users/entities/user.entity';
import { applyStorageActorScope } from './storage-actor-scope.util';

const buildQueryBuilder = () => {
  const builder = {
    innerJoin: jest.fn(() => builder),
    andWhere: jest.fn(() => builder),
  };
  return builder;
};

describe('applyStorageActorScope', () => {
  it('no restringe nada para ADMIN', () => {
    const builder = buildQueryBuilder();
    applyStorageActorScope(builder as never, buildActor(UserRole.ADMIN));

    expect(builder.andWhere).not.toHaveBeenCalled();
    expect(builder.innerJoin).not.toHaveBeenCalled();
  });

  it('restringe a STUDENT a sus propios artefactos STUDENT_SOURCE', () => {
    const actor = buildActor(UserRole.STUDENT, 'student-1');
    const builder = buildQueryBuilder();

    applyStorageActorScope(builder as never, actor);

    expect(builder.andWhere).toHaveBeenCalledWith(
      'storage.assetRole = :studentSourceRole',
      { studentSourceRole: 'STUDENT_SOURCE' },
    );
    expect(builder.andWhere).toHaveBeenCalledWith(
      'delivery.authorId = :requestUserId',
      { requestUserId: actor.userId },
    );
    expect(builder.innerJoin).not.toHaveBeenCalled();
  });

  it('restringe a TEACHER via project.teachers', () => {
    const actor = buildActor(UserRole.TEACHER, 'teacher-1');
    const builder = buildQueryBuilder();

    applyStorageActorScope(builder as never, actor);

    expect(builder.innerJoin).toHaveBeenCalledWith(
      'project.teachers',
      'teacher',
    );
    expect(builder.andWhere).toHaveBeenCalledWith(
      'teacher.id = :requestUserId',
      { requestUserId: actor.userId },
    );
  });
});
