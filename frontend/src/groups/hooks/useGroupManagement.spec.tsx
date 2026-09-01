import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BulkGroupEnrollResponse, CourseGroupEntity, GroupEnrollmentEntity } from "../../features/groups/types";
import type { UserEntity } from "../../features/auth/types";
import { renderHookWithProviders } from "../../test/renderWithProviders";

vi.mock("../api/groupsApi", () => ({
  groupsApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    listEnrollments: vi.fn(),
    bulkEnroll: vi.fn(),
    revokeEnrollment: vi.fn(),
  },
}));
vi.mock("../../users/api/usersApi", () => ({
  usersApi: { list: vi.fn() },
}));

import { groupsApi } from "../api/groupsApi";
import { usersApi } from "../../users/api/usersApi";
import { useGroupManagement } from "./useGroupManagement";

const group: CourseGroupEntity = {
  id: "group-1",
  name: "2º DAW",
  code: "DAW-2",
  description: "Grupo de tarde",
  createdById: "teacher-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
  studentCount: 0,
};

const student = {
  id: "student-1",
  firstName: "Ana",
  lastName: "García",
  email: "ana@example.com",
  role: "STUDENT",
  status: "ACTIVE",
} as UserEntity;

const meta = {
  page: 1,
  limit: 20,
  total: 1,
  totalPages: 1,
  hasNextPage: false,
  hasPrevPage: false,
};

function enrollment(index: number): GroupEnrollmentEntity {
  return {
    id: `enrollment-${index}`,
    groupId: group.id,
    groupName: group.name,
    studentId: `student-${index}`,
    studentEmail: `student-${index}@example.com`,
    studentName: `Alumno ${String(index).padStart(2, "0")}`,
    enrolledById: "teacher-1",
    enrolledAt: "2026-01-03T00:00:00.000Z",
    revokedAt: null,
  };
}

function renderManagement(overrides: Partial<Parameters<typeof useGroupManagement>[0]> = {}) {
  return renderHookWithProviders(
    () =>
      useGroupManagement({
        canWrite: true,
        focusedGroupId: group.id,
        studentSearch: "",
        studentPage: 1,
        directoryEnabled: true,
        ...overrides,
      }),
    { withWorkspace: false },
  );
}

describe("useGroupManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(groupsApi.list).mockResolvedValue([group]);
    vi.mocked(groupsApi.listEnrollments).mockResolvedValue([]);
    vi.mocked(usersApi.list).mockResolvedValue({ data: [student], meta });
    vi.mocked(groupsApi.bulkEnroll).mockResolvedValue({
      enrollments: [],
      summary: {
        requestedIds: [],
        requestedEmails: [],
        resolvedStudentIds: [],
        enrolledCount: 1,
        reactivatedCount: 0,
        alreadyActiveCount: 0,
        unresolvedEmails: [],
        unresolvedNames: [],
      },
    });
    vi.mocked(groupsApi.revokeEnrollment).mockResolvedValue({ message: "ok" });
    vi.mocked(groupsApi.remove).mockResolvedValue(undefined);
  });

  it("carga grupos, matrículas y directorio una sola vez al montar", async () => {
    renderManagement();

    await waitFor(() => {
      expect(groupsApi.list).toHaveBeenCalledTimes(1);
      expect(groupsApi.listEnrollments).toHaveBeenCalledTimes(1);
      expect(usersApi.list).toHaveBeenCalledTimes(1);
    });

    expect(groupsApi.listEnrollments).toHaveBeenCalledWith(group.id);
    expect(usersApi.list).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        limit: 20,
        role: "STUDENT",
        sortBy: "lastName",
        sortOrder: "ASC",
      }),
    );
  });

  it("el roster matriculado no queda limitado por la página del directorio", async () => {
    const roster = Array.from({ length: 65 }, (_, index) => enrollment(index));
    vi.mocked(groupsApi.listEnrollments).mockResolvedValue(roster);
    vi.mocked(usersApi.list).mockResolvedValue({ data: [student], meta });

    const { result } = renderManagement();

    await waitFor(() => expect(result.current.activeEnrollments).toHaveLength(65));
    expect(result.current.studentDirectory).toHaveLength(1);
  });

  it("consulta el directorio con la página y búsqueda recibidas", async () => {
    renderManagement({ studentPage: 3, studentSearch: "ana garcía" });

    await waitFor(() => expect(usersApi.list).toHaveBeenCalled());
    expect(usersApi.list).toHaveBeenCalledWith(
      expect.objectContaining({ page: 3, search: "ana garcía", limit: 20 }),
    );
  });

  it("matricula un alumno y refresca lista y roster", async () => {
    const { result } = renderManagement();
    await waitFor(() => expect(groupsApi.list).toHaveBeenCalledTimes(1));

    await act(async () => {
      expect(await result.current.enrollStudent(student.id)).toBe(true);
    });

    expect(groupsApi.bulkEnroll).toHaveBeenCalledWith(group.id, {
      studentIds: [student.id],
    });
    await waitFor(() => {
      expect(groupsApi.list).toHaveBeenCalledTimes(2);
      expect(groupsApi.listEnrollments).toHaveBeenCalledTimes(2);
    });
  });

  it("devuelve el detalle de incidencias de la importación masiva", async () => {
    vi.mocked(groupsApi.bulkEnroll).mockResolvedValue({
      enrollments: [],
      summary: {
        requestedIds: [],
        requestedEmails: ["no-existe@example.com"],
        resolvedStudentIds: [],
        enrolledCount: 0,
        reactivatedCount: 1,
        alreadyActiveCount: 2,
        unresolvedEmails: ["no-existe@example.com"],
        unresolvedNames: ["Persona Desconocida"],
      },
    });
    const { result } = renderManagement();
    await waitFor(() => expect(groupsApi.list).toHaveBeenCalled());

    let response = null;
    await act(async () => {
      response = await result.current.bulkEnroll("no-existe@example.com");
    });

    expect((response as BulkGroupEnrollResponse | null)?.summary.unresolvedEmails).toEqual(["no-existe@example.com"]);
    expect(result.current.notice).toMatchObject({ tone: "warning" });
  });
});
/**
 * Pruebas del hook que coordina consultas, mutaciones y selección de grupos.
 */
