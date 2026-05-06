import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import InternDetailPanel from "../components/InternDetailPanel.jsx";

vi.mock("../services/companyProgressService.js", () => ({
  getCompanyProgress: vi.fn(async () => ({
    id: "progress-1",
    progression_stage: "INTERNSHIP",
    progress_status: "IN_PROGRESS",
    internship_start_date: "2026-06-01",
    internship_end_date: "2026-09-01",
    contract_type: null,
    contract_start_date: null,
    updated_at: "2026-06-02T09:00:00.000Z",
  })),
}));

vi.mock("../components/CompanyProgressTimeline.jsx", () => ({
  default: () => <div>timeline</div>,
}));

vi.mock("../services/internFollowupService.js", () => ({
  listFollowupLogs: vi.fn(async () => []),
  createFollowupLog: vi.fn(),
  updateFollowupLog: vi.fn(),
  deleteFollowupLog: vi.fn(),
  calcAttendanceStats: vi.fn(() => ({ present: 0, absent: 0, justified: 0, pct: null })),
  calcAvgPerformance: vi.fn(() => null),
  getRatingLabel: vi.fn(() => ""),
  listObjectives: vi.fn(async () => []),
  createObjective: vi.fn(),
  updateObjective: vi.fn(),
  deleteObjective: vi.fn(),
  listEvaluations: vi.fn(async () => []),
  upsertEvaluation: vi.fn(),
  RECOMMENDATION_LABELS: {},
}));

describe("InternDetailPanel", () => {
  it("exibe resumo de etapa e ações rápidas no modo empresa", async () => {
    render(
      <InternDetailPanel
        app={{
          student: { id: "student-1", full_name: "Aluno Teste", email: "aluno@giva.ao" },
          vacancy: { title: "Estágio QA" },
        }}
        partnerId="partner-1"
        isCompanyView
        t={(key) => key}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Resumo do percurso")).toBeInTheDocument();
      expect(screen.getByText("Etapa: Estágio")).toBeInTheDocument();
      expect(screen.getByText("Estado: Em progresso")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /abrir presenças/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /abrir avaliações/i })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: /abrir avaliações/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /nova avaliação intercalar/i })).toBeEnabled();
      expect(screen.getByRole("button", { name: /nova avaliação final/i })).toBeDisabled();
    });
  });
});
