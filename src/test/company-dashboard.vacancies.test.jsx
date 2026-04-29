import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import CompanyDashboardPage from "../pages/CompanyDashboardPage.jsx";

const mocks = vi.hoisted(() => ({
  showToast: vi.fn(),
  getMyPartner: vi.fn(),
  listPartnerApplications: vi.fn(),
  listPartnerVacancies: vi.fn(),
  updatePartnerVacancyStatus: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
  useOutletContext: () => ({
    t: (key) => key,
    showToast: mocks.showToast,
  }),
}));

vi.mock("../contexts/AuthContext.jsx", () => ({
  useAuth: () => ({
    authProfile: { displayName: "Empresa Demo GIVA", email: "empresa.demo@giva.ao" },
  }),
}));

vi.mock("../services/partnersService.js", () => ({
  createPartner: vi.fn(),
  getMyPartner: mocks.getMyPartner,
}));

vi.mock("../services/jobApplicationService.js", () => ({
  listPartnerApplications: mocks.listPartnerApplications,
  acceptJobApplication: vi.fn(),
  rejectJobApplication: vi.fn(),
}));

vi.mock("../services/vacanciesService.js", () => ({
  createPartnerVacancy: vi.fn(),
  listPartnerVacancies: mocks.listPartnerVacancies,
  updatePartnerVacancyStatus: mocks.updatePartnerVacancyStatus,
}));

vi.mock("../components/PageHeader.jsx", () => ({
  default: ({ title, description }) => (
    <header>
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  ),
}));

vi.mock("../components/CompanyProgressTimeline.jsx", () => ({
  default: () => <div>timeline</div>,
}));

describe("CompanyDashboardPage - Vacancies", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getMyPartner.mockResolvedValue({
      id: "partner-1",
      empresa: "Empresa Demo GIVA",
      vagas: 2,
    });

    mocks.listPartnerApplications.mockResolvedValue([
      {
        id: "app-1",
        partner_id: "partner-1",
        vacancy_id: "vac-1",
        status: "PENDING",
        applied_at: new Date().toISOString(),
        student: { id: "s-1", full_name: "Ana Melo", email: "ana@giva.ao" },
        vacancy: { id: "vac-1", title: "Estagio Frontend React" },
      },
    ]);

    mocks.listPartnerVacancies.mockResolvedValue([
      {
        id: "vac-1",
        title: "Estagio Frontend React",
        description: "Vaga para frontend",
        status: "OPEN",
        total_slots: 2,
        filled_slots: 0,
        available_slots: 2,
      },
    ]);

    mocks.updatePartnerVacancyStatus.mockResolvedValue({ id: "vac-1", status: "CLOSED" });
  });

  it("abre modal de confirmacao ao tentar fechar vaga", async () => {
    render(<CompanyDashboardPage />);

    await screen.findByText(/Vagas publicadas/i);
    fireEvent.click(screen.getByRole("button", { name: /Fechar vaga/i }));

    expect(screen.getByRole("heading", { name: /Fechar vaga/i })).toBeInTheDocument();
    expect(screen.getByText(/Confirma o fecho da vaga/i)).toBeInTheDocument();
  });

  it("bloqueia fechamento quando ha candidaturas pendentes", async () => {
    render(<CompanyDashboardPage />);

    await screen.findByText(/Vagas publicadas/i);
    fireEvent.click(screen.getByRole("button", { name: /Fechar vaga/i }));
    fireEvent.click(screen.getByRole("button", { name: /Confirmar/i }));

    await waitFor(() => {
      expect(mocks.showToast).toHaveBeenCalledWith(
        expect.stringContaining("candidaturas pendentes"),
        "error"
      );
    });

    expect(mocks.updatePartnerVacancyStatus).not.toHaveBeenCalled();
  });
});
