import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import CompanyProgressTimeline from "../components/CompanyProgressTimeline.jsx";

const serviceState = vi.hoisted(() => ({
  progress: {
    id: "progress-1",
    progression_stage: "INTERNSHIP",
    progress_status: "IN_PROGRESS",
    internship_start_date: "2026-06-01",
    internship_end_date: "2026-09-01",
    internship_has_compensation: false,
    internship_compensation_amount: null,
    internship_duration_months: 3,
    contract_type: "",
    contract_start_date: "",
    contract_end_date: "",
    contract_salary: "",
    updated_at: "2026-06-01T10:00:00.000Z",
    company_assessment_text: "",
  },
}));

vi.mock("../services/companyProgressService.js", () => ({
  getCompanyProgress: vi.fn(async () => serviceState.progress),
  updateInterviewPhase: vi.fn(),
  updateInternshipPhase: vi.fn(),
  updateContractPhase: vi.fn(),
  addMutualAssessment: vi.fn(),
  completeProgress: vi.fn(),
  terminateProgress: vi.fn(),
}));

describe("CompanyProgressTimeline", () => {
  it("mostra o painel de contrato quando a fase ativa e INTERNSHIP no modo empresa", async () => {
    render(
      <CompanyProgressTimeline
        studentId="student-1"
        partnerId="partner-1"
        t={(key) => key}
        isCompanyView
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "progressCompany.contract.fixedTerm" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /marcar como concluído/i })).toBeInTheDocument();
    });
  });
});