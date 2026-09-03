import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  StudentReportView as StudentReport,
  TeacherReportView as TeacherReport,
} from "@educodeai/contracts";
import { StudentReportView } from "@/reporting/components/StudentReportView";
import { TeacherReportView } from "@/reporting/components/TeacherReportView";

const studentReport: StudentReport = {
  schemaVersion: "builder-report/v3",
  audience: "student",
  buildRunId: "run-1",
  deliveryId: "delivery-1",
  deliveryVersion: 2,
  generatedAt: "2026-09-02T10:00:00.000Z",
  outcome: "PARTIAL",
  grade: { value: 8, status: "PROVISIONAL" },
  narrative: {
    headline: "Has resuelto el flujo principal.",
    achievements: ["Los tests públicos pasan."],
    gaps: ["Falta validar la entrada vacía."],
    conceptBridges: ["Usa una guarda temprana."],
    nextSteps: ["Añade el test del caso vacío."],
  },
  rubric: [
    {
      id: "criterion-1",
      name: "Funcionalidad",
      maxPoints: 10,
      awarded: 8,
      status: "PARTIAL",
      explanation: "El caso principal funciona.",
      evidenceIds: ["evidence-1"],
    },
  ],
  evidence: [
    {
      id: "evidence-1",
      kind: "execution",
      summary: "Suite pública",
      detail: "4/4 tests correctos.",
    },
  ],
  blockers: [],
  nextSteps: ["Añade el test del caso vacío."],
  limitations: ["No se probó en Windows."],
  comparison: { reason: "FIRST_ATTEMPT" },
  advanced: {
    findings: [
      {
        id: "finding-1",
        category: "evaluation",
        severity: "medium",
        title: "Caso límite pendiente",
        explanation: "No se valida la entrada vacía.",
        recommendation: "Añade una guarda.",
        blocking: false,
        evidenceIds: ["evidence-1"],
      },
    ],
    warnings: [],
  },
};

const teacherReport: TeacherReport = {
  schemaVersion: "builder-report/v3",
  audience: "teacher",
  buildRunId: "run-1",
  deliveryId: "delivery-1",
  deliveryVersion: 2,
  generatedAt: "2026-09-02T10:00:00.000Z",
  outcome: "PARTIAL",
  grade: { provisional: 8, official: 7.5, delta: -0.5 },
  confidence: "high",
  narrative: {
    executiveSummary: "Entrega funcional con revisión recomendada.",
    strengths: ["Estructura clara."],
    concerns: ["Cobertura incompleta."],
    followUp: ["Revisar el caso vacío."],
    reviewQuestions: ["¿Qué contrato espera para una entrada vacía?"],
  },
  rubric: studentReport.rubric,
  evidence: studentReport.evidence,
  findings: studentReport.advanced.findings,
  limitations: studentReport.limitations,
  reviewFlags: ["CHECK_EDGE_CASE"],
  comparison: studentReport.comparison,
  studentPreview: studentReport,
  audit: {
    evaluationSchemaVersion: "builder-evaluation/v3",
    reportCopySchemaVersion: "builder-report-copy/v1",
    usedNarrativeFallback: false,
    promptVersion: "prompt-v3",
  },
};

describe("report views v3", () => {
  it("puts student actions and evidence first and keeps technical details closed", () => {
    const onExport = vi.fn();
    const { container } = render(
      <StudentReportView report={studentReport} onExport={onExport} />,
    );

    const actions = screen.getByText("Tus próximos pasos");
    const evidence = screen.getByText("Evidencia");
    expect(
      actions.compareDocumentPosition(evidence) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(container.querySelector("details")).not.toHaveAttribute("open");
    expect(screen.getByText("Provisional")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Exportar Markdown" }));
    expect(onExport).toHaveBeenCalledOnce();
  });

  it("shows teacher decisions, exact student preview and both export actions", () => {
    const onExport = vi.fn();
    const onExportStudent = vi.fn();
    const onUseAiGrade = vi.fn();
    const { container } = render(
      <TeacherReportView
        report={teacherReport}
        onExport={onExport}
        onExportStudent={onExportStudent}
        onUseAiGrade={onUseAiGrade}
      />,
    );

    expect(screen.getByText("Propuesta de la IA")).toBeInTheDocument();
    expect(screen.getByText("Decisión académica")).toBeInTheDocument();
    expect(
      screen.getByText("Vista previa exacta del alumno"),
    ).toBeInTheDocument();
    expect(container.querySelector("details")).not.toHaveAttribute("open");

    fireEvent.click(
      screen.getByRole("button", { name: "Usar propuesta de la IA" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Exportar vista docente" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Exportar vista alumno" }),
    );
    expect(onUseAiGrade).toHaveBeenCalledWith(8);
    expect(onExport).toHaveBeenCalledOnce();
    expect(onExportStudent).toHaveBeenCalledOnce();
  });
});
