import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { PropsWithChildren } from "react";

vi.mock("../../shared/api/services", () => ({
  deliveriesApi: { create: vi.fn(), preview: vi.fn() },
  storageApi: { upload: vi.fn() },
}));
vi.mock("../../shared/api/builderApi", () => ({
  builderApi: { runForDelivery: vi.fn() },
}));
vi.mock("../../shared/utils/hash", () => ({
  computeSha256Hex: vi.fn().mockResolvedValue("deadbeef"),
}));

import { deliveriesApi, storageApi } from "../../shared/api/services";
import { builderApi } from "../../shared/api/builderApi";
import { SessionProvider } from "../../shared/session/SessionContext";
import { WorkspaceProvider } from "../../shared/workspace/WorkspaceContext";
import { useSubmissionFlow } from "./useSubmissionFlow";
import type { StudentWorkspaceData } from "./useStudentWorkspaceData";
import type { ProjectAssignmentEntity } from "../../shared/types";

function buildAssignment(
  overrides: Partial<ProjectAssignmentEntity> = {},
): ProjectAssignmentEntity {
  return {
    id: "assignment-1",
    projectId: "project-1",
    projectTitle: "Proyecto Final",
    projectExpectedType: null,
    teachers: [],
    maxDeliveriesPerStudent: 3,
    sourceGroupIds: [],
    studentId: "student-1",
    studentEmail: "alumno@dockus.local",
    studentName: "Alumno Uno",
    assignedById: "teacher-1",
    assignedAt: "2026-01-01T00:00:00.000Z",
    revokedAt: null,
    opensAt: null,
    closesAt: null,
    deliveryCount: 0,
    remainingDeliveries: 3,
    minimumRequirementMet: false,
    rubricInstructions: null,
    ...overrides,
  } as ProjectAssignmentEntity;
}

function buildWorkspaceData(
  overrides: Partial<StudentWorkspaceData> = {},
): StudentWorkspaceData {
  return {
    assignments: [buildAssignment()],
    deliveries: [],
    latestDelivery: null,
    latestRunByDeliveryId: {},
    loading: false,
    error: null,
    refresh: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function wrapper({ children }: PropsWithChildren) {
  return (
    <SessionProvider>
      <WorkspaceProvider>{children}</WorkspaceProvider>
    </SessionProvider>
  );
}

describe("useSubmissionFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(deliveriesApi.preview).mockResolvedValue([]);
  });

  it("blocks advancing past step 1 when the assignment has no remaining deliveries", () => {
    const data = buildWorkspaceData({
      assignments: [buildAssignment({ remainingDeliveries: 0 })],
    });

    const { result } = renderHook(() => useSubmissionFlow(data), { wrapper });

    expect(result.current.canContinueFromStep1).toBe(false);
    expect(result.current.noRemainingDeliveries).toBe(true);

    act(() => {
      result.current.handleNextStep();
    });

    expect(result.current.step).toBe(1);
  });

  it("blocks advancing past step 1 before the assignment window opens", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const data = buildWorkspaceData({
      assignments: [buildAssignment({ opensAt: future })],
    });

    const { result } = renderHook(() => useSubmissionFlow(data), { wrapper });

    expect(result.current.notYetOpen).toBe(true);
    expect(result.current.canContinueFromStep1).toBe(false);
  });

  it("rejects files over 50MB without touching the upload flow", () => {
    const data = buildWorkspaceData();
    const { result } = renderHook(() => useSubmissionFlow(data), { wrapper });

    const oversized = new File([new Uint8Array(1)], "big.zip", {
      type: "application/zip",
    });
    Object.defineProperty(oversized, "size", { value: 51 * 1024 * 1024 });

    act(() => {
      result.current.handleFileSelection(oversized);
    });

    expect(result.current.fileSizeError).toBe(true);
    expect(result.current.file).toBeNull();
  });

  it("advances 1→2→3 once an assignment is selected and a file is chosen", () => {
    const data = buildWorkspaceData();
    const { result } = renderHook(() => useSubmissionFlow(data), { wrapper });

    act(() => {
      result.current.handleNextStep();
    });
    expect(result.current.step).toBe(2);

    // No file yet: step 2→3 must not advance.
    act(() => {
      result.current.handleNextStep();
    });
    expect(result.current.step).toBe(2);

    act(() => {
      result.current.handleFileSelection(
        new File(["contenido"], "entrega.zip", { type: "application/zip" }),
      );
    });

    act(() => {
      result.current.handleNextStep();
    });
    expect(result.current.step).toBe(3);
  });

  it("submits: creates the delivery, uploads with its computed hash, refreshes, and lands on step 4", async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    const data = buildWorkspaceData({ refresh });
    vi.mocked(deliveriesApi.create).mockResolvedValue({
      id: "delivery-9",
      version: 2,
    } as any);
    vi.mocked(storageApi.upload).mockResolvedValue({} as any);

    const { result } = renderHook(() => useSubmissionFlow(data), { wrapper });

    act(() => {
      result.current.handleFileSelection(
        new File(["contenido"], "entrega.zip", { type: "application/zip" }),
      );
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(deliveriesApi.create).toHaveBeenCalledWith({
      assignmentId: "assignment-1",
    });
    expect(storageApi.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        deliveryId: "delivery-9",
        hash: "deadbeef",
        logicalName: "entrega.zip",
      }),
    );
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("success");
    expect(result.current.step).toBe(4);
  });

  it("submit failure surfaces the error message and does not advance the step", async () => {
    const data = buildWorkspaceData();
    vi.mocked(deliveriesApi.create).mockRejectedValue({
      response: { data: { message: "Cupo de entregas agotado" } },
    });

    const { result } = renderHook(() => useSubmissionFlow(data), { wrapper });

    act(() => {
      result.current.handleFileSelection(
        new File(["contenido"], "entrega.zip", { type: "application/zip" }),
      );
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(result.current.status).toBe("error");
    expect(result.current.step).not.toBe(4);
    expect(storageApi.upload).not.toHaveBeenCalled();
  });

  it("launching the evaluation after a successful submit calls the builder API and flags buildLaunched", async () => {
    const data = buildWorkspaceData();
    vi.mocked(deliveriesApi.create).mockResolvedValue({
      id: "delivery-9",
      version: 1,
    } as any);
    vi.mocked(storageApi.upload).mockResolvedValue({} as any);
    vi.mocked(builderApi.runForDelivery).mockResolvedValue({
      buildRunId: "run-1",
    } as any);

    const { result } = renderHook(() => useSubmissionFlow(data), { wrapper });

    act(() => {
      result.current.handleFileSelection(
        new File(["contenido"], "entrega.zip", { type: "application/zip" }),
      );
    });
    await act(async () => {
      await result.current.handleSubmit();
    });

    await act(async () => {
      await result.current.handleLaunchBuilder();
    });

    expect(builderApi.runForDelivery).toHaveBeenCalledWith("delivery-9");
    expect(result.current.buildLaunched).toBe(true);
    expect(result.current.buildError).toBeNull();
  });

  it("launch failure surfaces buildError instead of throwing", async () => {
    const data = buildWorkspaceData();
    vi.mocked(deliveriesApi.create).mockResolvedValue({
      id: "delivery-9",
      version: 1,
    } as any);
    vi.mocked(storageApi.upload).mockResolvedValue({} as any);
    vi.mocked(builderApi.runForDelivery).mockRejectedValue({
      response: { data: { message: "Cuota de gasto agotada" } },
    });

    const { result } = renderHook(() => useSubmissionFlow(data), { wrapper });

    act(() => {
      result.current.handleFileSelection(
        new File(["contenido"], "entrega.zip", { type: "application/zip" }),
      );
    });
    await act(async () => {
      await result.current.handleSubmit();
    });

    await act(async () => {
      await result.current.handleLaunchBuilder();
    });

    expect(result.current.buildLaunched).toBe(false);
    expect(result.current.buildError).toBeTruthy();
  });
});
