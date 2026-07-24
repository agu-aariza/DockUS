/**
 * @fileoverview Módulo de proyectos académicos y entregas (reconcile-operational-issues.dto).
 *
 * @module reconcile-operational-issues.dto
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsOptional } from 'class-validator';

export const RECONCILE_OPERATIONAL_ISSUE_MODES = ['dry-run', 'apply'] as const;

export type ReconcileOperationalIssueMode =
  (typeof RECONCILE_OPERATIONAL_ISSUE_MODES)[number];

export const RECONCILE_OPERATIONAL_ISSUE_CATEGORIES = [
  'orphanAssignments',
  'orphanDeliveries',
  'orphanStorageObjects',
] as const;

export type ReconcileOperationalIssueCategory =
  (typeof RECONCILE_OPERATIONAL_ISSUE_CATEGORIES)[number];

export class ReconcileOperationalIssuesDto {
  @ApiPropertyOptional({
    enum: RECONCILE_OPERATIONAL_ISSUE_MODES,
    default: 'dry-run',
    description:
      'dry-run solo simula acciones. apply ejecuta la reconciliación real.',
  })
  @IsEnum(RECONCILE_OPERATIONAL_ISSUE_MODES, {
    message: 'mode debe ser dry-run o apply.',
  })
  @IsOptional()
  mode?: ReconcileOperationalIssueMode;

  @ApiPropertyOptional({
    enum: RECONCILE_OPERATIONAL_ISSUE_CATEGORIES,
    isArray: true,
    description:
      'Categorías de incidencias a reconciliar. Si se omite, se aplican todas las reconciliables.',
  })
  @IsArray()
  @IsEnum(RECONCILE_OPERATIONAL_ISSUE_CATEGORIES, {
    each: true,
    message: 'categories contiene una categoría no soportada.',
  })
  @Type(() => String)
  @IsOptional()
  categories?: ReconcileOperationalIssueCategory[];
}
