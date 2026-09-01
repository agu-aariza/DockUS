/**
 * @fileoverview Pruebas unitarias del scoping de `BuildRun` (agregado por
 * entrega) por actor.
 *
 * Contexto:
 * - Comprueba las reglas de visibilidad de las ejecuciones agrupadas por
 *   entrega para cada rol y sus joins obligatorios.
 *
 * @module BuildRunActorScopeUtilSpec
 */

import { buildActor } from '@test/support/domain-builders';
import { UserRole } from '@app/modules/users/entities/user.entity';
import { applyBuildRunActorScope } from '@app/modules/projects/builder/infrastructure/database/build-run-actor-scope.util';

const buildQueryBuilder = () => {
  const builder = {
    innerJoin: jest.fn(() => builder),
    andWhere: jest.fn(() => builder),
  };
  return builder;
};

describe('applyBuildRunActorScope', () => {
  it('no restringe nada para ADMIN', () => {
    const builder = buildQueryBuilder();
    applyBuildRunActorScope(builder as never, buildActor(UserRole.ADMIN));

    expect(builder.andWhere).not.toHaveBeenCalled();
    expect(builder.innerJoin).not.toHaveBeenCalled();
  });

  it('restringe a STUDENT via delivery.authorId, sin join adicional', () => {
    const actor = buildActor(UserRole.STUDENT, 'student-1');
    const builder = buildQueryBuilder();

    applyBuildRunActorScope(builder as never, actor);

    expect(builder.andWhere).toHaveBeenCalledWith(
      'delivery.authorId = :userId',
      {
        userId: actor.userId,
      },
    );
    expect(builder.innerJoin).not.toHaveBeenCalledWith(
      'project.teachers',
      'scopedTeacher',
    );
  });

  it('restringe a TEACHER via project.teachers', () => {
    const actor = buildActor(UserRole.TEACHER, 'teacher-1');
    const builder = buildQueryBuilder();

    applyBuildRunActorScope(builder as never, actor);

    expect(builder.innerJoin).toHaveBeenCalledWith(
      'project.teachers',
      'scopedTeacher',
    );
    expect(builder.andWhere).toHaveBeenCalledWith(
      'scopedTeacher.id = :userId',
      {
        userId: actor.userId,
      },
    );
  });
});
