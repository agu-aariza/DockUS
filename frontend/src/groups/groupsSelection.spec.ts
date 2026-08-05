import { describe, expect, it } from "vitest";
import type { CourseGroupEntity } from "../features/groups/types";
import {
  nextGroupIdAfterDeletion,
  resolveFocusedGroupId,
} from "./groupsSelection";

const groups = ["a", "b", "c"].map(
  (id, index) =>
    ({
      id,
      name: `Grupo ${id}`,
      code: id.toUpperCase(),
      description: null,
      createdById: "teacher",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      studentCount: index,
    }) satisfies CourseGroupEntity,
);

describe("selección de grupos", () => {
  it("conserva primero una selección actual válida", () => {
    expect(resolveFocusedGroupId(groups, "b", "c")).toBe("b");
  });

  it("respeta un enlace profundo cuando aún no hay selección", () => {
    expect(resolveFocusedGroupId(groups, "", "c")).toBe("c");
  });

  it("usa el primer grupo si el enlace profundo es inválido", () => {
    expect(resolveFocusedGroupId(groups, "", "missing")).toBe("a");
  });

  it("elige el vecino que ocupa la posición del grupo eliminado", () => {
    expect(nextGroupIdAfterDeletion(groups, "b")).toBe("c");
    expect(nextGroupIdAfterDeletion(groups, "c")).toBe("b");
    expect(nextGroupIdAfterDeletion([groups[0]], "a")).toBe("");
  });
});
/**
 * Pruebas de las utilidades puras para normalizar y resolver selecciones de grupos.
 */
