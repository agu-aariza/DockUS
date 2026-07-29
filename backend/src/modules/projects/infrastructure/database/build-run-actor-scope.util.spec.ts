/**
 * @fileoverview Pruebas unitarias del scoping de `BuildRun` (agregado por
 * entrega) por actor.
 *
 * Contexto:
 * - Extraído de `builder-run-queries.service.spec.ts` (plan_accion.md P2-4):
 *   la lógica que estas pruebas cubrían vivía antes en
 *   `BuilderRunQueriesService`, ahora vive en `BuildRunRepository` a través
 *   de este util — las pruebas se mueven con el código, mismo comportamiento
 *   (HIGH-09).
 *
 * @module BuildRunActorScopeUtilSpec
 */

import { buildActor } from '../../../../test-support/domain-builders';
import { UserRole } from '../../../users/entities/user.entity';
import { applyBuildRunActorScope } from './build-run-actor-scope.util';

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

  it('HIGH-09: restringe a STUDENT via delivery.authorId, sin join adicional', () => {
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

  it('HIGH-09: restringe a TEACHER via project.teachers', () => {
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
