import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";

vi.mock("@/deliveries/api/deliveriesApi", () => ({
  deliveriesApi: { create: vi.fn(), preview: vi.fn() },
}));
vi.mock("@/storage/api/storageApi", () => ({
  storageApi: { upload: vi.fn() },
}));
vi.mock("@/builder/api/builderApi", () => ({
  builderApi: { runForDelivery: vi.fn() },
}));
vi.mock("@/shared/utils/hash", () => ({
  computeSha256Hex: vi.fn().mockResolvedValue("deadbeef"),
}));

import { deliveriesApi } from "@/deliveries/api/deliveriesApi";
import { storageApi } from "@/storage/api/storageApi";
import { builderApi } from "@/builder/api/builderApi";
import { SessionProvider } from "@/shared/session/SessionContext";
import { WorkspaceProvider } from "@/shared/workspace/WorkspaceContext";
import { createTestQueryClient } from "@test/support/renderWithProviders";
import { useSubmissionFlow } from "@/student/hooks/useSubmissionFlow";
import type { StudentWorkspaceData } from "@/student/hooks/useStudentWorkspaceData";
import type { ProjectAssignmentEntity } from "@/features/projects/types";

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
    studentEmail: "alumno@educodeai.local",
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
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <WorkspaceProvider>{children}</WorkspaceProvider>
      </SessionProvider>
    </QueryClientProvider>
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

  it("reuses pending delivery on upload failure retry without calling create twice", async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    const data = buildWorkspaceData({ refresh });
    vi.mocked(deliveriesApi.create).mockResolvedValue({
      id: "delivery-resilient",
      version: 1,
    } as any);
    vi.mocked(storageApi.upload)
      .mockRejectedValueOnce(new Error("Network disconnect during upload"))
      .mockResolvedValueOnce({} as any);

    const { result } = renderHook(() => useSubmissionFlow(data), { wrapper });

    act(() => {
      result.current.handleFileSelection(
        new File(["contenido"], "entrega.zip", { type: "application/zip" }),
      );
    });

    // First attempt fails at storageApi.upload
    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(deliveriesApi.create).toHaveBeenCalledTimes(1);
    expect(storageApi.upload).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("error");
    expect(result.current.errorMessage).toContain("Network disconnect during upload");
    expect(result.current.pendingDelivery).toEqual({ id: "delivery-resilient", version: 1 });

    // Retry handleSubmit: must reuse existing delivery without calling deliveriesApi.create again
    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(deliveriesApi.create).toHaveBeenCalledTimes(1);
    expect(storageApi.upload).toHaveBeenCalledTimes(2);
    expect(storageApi.upload).toHaveBeenLastCalledWith(
      expect.objectContaining({
        deliveryId: "delivery-resilient",
      }),
    );
    expect(result.current.status).toBe("success");
    expect(result.current.step).toBe(4);
    expect(result.current.pendingDelivery).toBeNull();
  });

  it("clears error state when navigating back to step 1 or step 2", async () => {
    const data = buildWorkspaceData();
    vi.mocked(deliveriesApi.create).mockRejectedValue(new Error("Fallo transitorio"));

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
    expect(result.current.errorMessage).toBeTruthy();

    act(() => {
      result.current.setStep(2);
    });

    expect(result.current.step).toBe(2);
    expect(result.current.status).toBe("idle");
    expect(result.current.errorMessage).toBe("");
  });

  it("resets pending delivery and errors when switching selected assignment", async () => {
    const data = buildWorkspaceData({
      assignments: [
        buildAssignment({ id: "assignment-1", projectTitle: "P1" }),
        buildAssignment({ id: "assignment-2", projectTitle: "P2" }),
      ],
    });
    vi.mocked(deliveriesApi.create).mockResolvedValue({
      id: "delivery-old",
      version: 1,
    } as any);
    vi.mocked(storageApi.upload).mockRejectedValue(new Error("Fallo red"));

    const { result } = renderHook(() => useSubmissionFlow(data), { wrapper });

    act(() => {
      result.current.handleFileSelection(
        new File(["contenido"], "entrega.zip", { type: "application/zip" }),
      );
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(result.current.pendingDelivery).toEqual({ id: "delivery-old", version: 1 });

    act(() => {
      result.current.setSelectedAssignmentId("assignment-2");
    });

    expect(result.current.selectedAssignmentId).toBe("assignment-2");
    expect(result.current.pendingDelivery).toBeNull();
    expect(result.current.errorMessage).toBe("");
    expect(result.current.status).toBe("idle");
  });
});
