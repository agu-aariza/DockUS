/**
 * @fileoverview Pruebas unitarias del scoping de `ProjectAssignment` por
 * actor (vista desde un alumno concreto).
 *
 * Contexto:
 * - Extraído de `student-profile.service.spec.ts` (plan_accion.md P2-3): la
 *   lógica que estas pruebas cubrían vivía antes en `StudentProfileService`,
 *   ahora vive en `ProjectAssignmentRepository` a través de este util — las
 *   pruebas se mueven con el código, mismo comportamiento.
 *
 * @module ProjectAssignmentActorScopeUtilSpec
 */

import { buildActor } from '../../../../test-support/domain-builders';
import { UserRole } from '../../../users/entities/user.entity';
import { applyProjectAssignmentActorScope } from './project-assignment-actor-scope.util';

const buildQueryBuilder = () => {
  const builder = {
    andWhere: jest.fn(() => builder),
  };
  return builder;
};

describe('applyProjectAssignmentActorScope', () => {
  it('no restringe nada para ADMIN', () => {
    const builder = buildQueryBuilder();
    applyProjectAssignmentActorScope(
      builder as never,
      buildActor(UserRole.ADMIN),
    );

    expect(builder.andWhere).not.toHaveBeenCalled();
  });

  it('restringe via project_teachers para TEACHER', () => {
    const actor = buildActor(
      UserRole.TEACHER,
      '55555555-5555-5555-5555-555555555555',
    );
    const builder = buildQueryBuilder();

    applyProjectAssignmentActorScope(builder as never, actor);

    expect(builder.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('project_teachers'),
      { actorId: actor.userId },
    );
  });
});
