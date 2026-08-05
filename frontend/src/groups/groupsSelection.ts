import type { CourseGroupEntity } from "../features/groups/types";

/**
 * Prioridad de selección: conservar una selección válida, respetar después el
 * enlace profundo y usar por último el primer grupo ya ordenado de la vista.
 */
export function resolveFocusedGroupId(
  groups: CourseGroupEntity[],
  currentId: string,
  requestedId: string,
): string {
  if (groups.some((group) => group.id === currentId)) return currentId;
  if (groups.some((group) => group.id === requestedId)) return requestedId;
  return groups[0]?.id ?? "";
}

/** Selecciona el vecino que ocupará la posición del grupo eliminado. */
export function nextGroupIdAfterDeletion(
  groups: CourseGroupEntity[],
  deletedId: string,
): string {
  const deletedIndex = groups.findIndex((group) => group.id === deletedId);
  const remaining = groups.filter((group) => group.id !== deletedId);
  if (remaining.length === 0) return "";
  const targetIndex = deletedIndex < 0 ? 0 : Math.min(deletedIndex, remaining.length - 1);
  return remaining[targetIndex].id;
}
