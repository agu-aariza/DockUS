import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BulkGroupEnrollResponse } from "@/features/groups/types";
import {
  BulkEnrollmentDialog,
  GroupFormDialog,
} from "@/groups/components/GroupDialogs";

function bulkResponse(unresolved: string[] = []): BulkGroupEnrollResponse {
  return {
    enrollments: [],
    summary: {
      requestedIds: [],
      requestedEmails: unresolved,
      resolvedStudentIds: [],
      enrolledCount: unresolved.length ? 0 : 2,
      reactivatedCount: 1,
      alreadyActiveCount: 1,
      unresolvedEmails: unresolved,
      unresolvedNames: [],
    },
  };
}

describe("GroupFormDialog", () => {
  it("envía nombre, código y descripción y se cierra tras guardar", async () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    const onClose = vi.fn();
    render(
      <GroupFormDialog
        open
        mode="create"
        submitting={false}
        onClose={onClose}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByLabelText("Nombre del grupo"), {
      target: { value: "2º DAW" },
    });
    fireEvent.change(screen.getByLabelText(/Código identificador/), {
      target: { value: "DAW-2" },
    });
    fireEvent.change(screen.getByLabelText(/Descripción/), {
      target: { value: "Grupo de tarde" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Crear grupo" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        name: "2º DAW",
        code: "DAW-2",
        description: "Grupo de tarde",
      }),
    );
    expect(onClose).toHaveBeenCalled();
  });
});

describe("BulkEnrollmentDialog", () => {
  it("mantiene la entrada y muestra los registros no resueltos", async () => {
    const onSubmit = vi.fn().mockResolvedValue(
      bulkResponse(["no-existe@example.com"]),
    );
    render(
      <BulkEnrollmentDialog
        open
        groupName="2º DAW"
        submitting={false}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    const input = screen.getByLabelText("Lista de alumnos");
    await waitFor(() => expect(input).toHaveFocus());
    fireEvent.change(input, { target: { value: "no-existe@example.com" } });
    fireEvent.click(
      screen.getByRole("button", { name: "Procesar matrículas" }),
    );

    await waitFor(() =>
      expect(screen.getByText("Revisa estos registros")).toBeInTheDocument(),
    );
    expect(input).toHaveValue("no-existe@example.com");
    expect(screen.getByText("• no-existe@example.com")).toBeInTheDocument();
  });

  it("limpia la entrada cuando todos los registros se procesan", async () => {
    render(
      <BulkEnrollmentDialog
        open
        groupName="2º DAW"
        submitting={false}
        onClose={vi.fn()}
        onSubmit={vi.fn().mockResolvedValue(bulkResponse())}
      />,
    );

    const input = screen.getByLabelText("Lista de alumnos");
    fireEvent.change(input, { target: { value: "ana@example.com" } });
    fireEvent.click(
      screen.getByRole("button", { name: "Procesar matrículas" }),
    );

    await waitFor(() => expect(input).toHaveValue(""));
    expect(
      screen.getByText("Todos los registros se procesaron correctamente."),
    ).toBeInTheDocument();
  });

  it("se puede cerrar con Escape cuando no está procesando", () => {
    const onClose = vi.fn();
    render(
      <BulkEnrollmentDialog
        open
        groupName="2º DAW"
        submitting={false}
        onClose={onClose}
        onSubmit={vi.fn()}
      />,
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
/**
 * Pruebas de los diálogos de creación, edición y eliminación de grupos.
 */
