import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import PartnersPage from "../pages/PartnersPage.jsx";

const mocks = vi.hoisted(() => ({
  showToast: vi.fn(),
  listPartners: vi.fn(),
  listOpenVacancies: vi.fn(),
  listStudentApplications: vi.fn(),
  listPartnerApplications: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
  useOutletContext: () => ({
    query: "",
    showToast: mocks.showToast,
    t: (key) => {
      const map = {
        "partners.title": "Parceiros",
        "partners.description": "Rede de empresas",
        "partners.register": "Registar parceiro",
        "partners.portfolio": "Portefólio",
        "partners.metrics.total": "Total",
        "partners.metrics.slots": "Vagas",
        "partners.metrics.avgSla": "SLA",
        "partners.metrics.withPhoto": "Com foto",
        "common.company": "Empresa",
        "partners.nif": "NIF",
        "partners.sector": "Setor",
        "partners.slots": "Vagas",
        "partners.performance": "Performance",
        "common.action": "Ação",
        "partners.sector.tech": "Tecnologia",
        "application.submit": "Candidatar",
      };
      return map[key] ?? key;
    },
  }),
}));

vi.mock("../contexts/AuthContext.jsx", () => ({
  useAuth: () => ({
    user: { id: "student-1" },
    authProfile: { role: "STUDENT" },
  }),
}));

vi.mock("../components/PageHeader.jsx", () => ({
  default: ({ title }) => <h1>{title}</h1>,
}));

vi.mock("../components/PanelSection.jsx", () => ({
  default: ({ title, children }) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
}));

vi.mock("../components/DataTable.jsx", () => ({
  default: ({ rows, columns }) => (
    <div>
      {rows.map((row) => (
        <div key={row.id} data-testid={`row-${row.id}`}>
          <span>{row.empresa}</span>
          <div>{columns.find((c) => c.key === "actions").render(row)}</div>
        </div>
      ))}
    </div>
  ),
}));

vi.mock("../components/PartnerRegisterModal.jsx", () => ({
  default: () => null,
}));

vi.mock("../components/JobApplicationModal.jsx", () => ({
  default: ({ partnerId }) => <div>JobApplicationModal-{partnerId}</div>,
}));

vi.mock("../services/partnersService.js", () => ({
  canUsePartnersApi: () => true,
  listPartners: mocks.listPartners,
  getMyPartner: vi.fn(),
  createPartner: vi.fn(),
  updatePartner: vi.fn(),
  deletePartner: vi.fn(),
}));

vi.mock("../services/vacanciesService.js", () => ({
  listOpenVacancies: mocks.listOpenVacancies,
}));

vi.mock("../services/jobApplicationService.js", () => ({
  listStudentApplications: mocks.listStudentApplications,
  listPartnerApplications: mocks.listPartnerApplications,
}));

describe("PartnersPage student vacancies visibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.listPartners.mockResolvedValue([
      {
        id: "partner-1",
        empresa: "Empresa Com Vaga",
        nif: "123",
        setor: "tech",
        vagas: "0",
      },
      {
        id: "partner-2",
        empresa: "Empresa Sem Vaga",
        nif: "456",
        setor: "tech",
        vagas: "999",
      },
    ]);

    mocks.listOpenVacancies.mockResolvedValue([
      {
        id: "vac-1",
        partner_id: "partner-1",
        available_slots: 2,
      },
    ]);

    mocks.listStudentApplications.mockResolvedValue([]);
    mocks.listPartnerApplications.mockResolvedValue([]);
  });

  it("mostra para aluno apenas parceiros com vagas abertas reais e permite abrir candidatura", async () => {
    render(<PartnersPage />);

    await waitFor(() => {
      expect(screen.getByTestId("row-partner-1")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("row-partner-2")).not.toBeInTheDocument();

    const applyBtn = screen.getByRole("button", { name: /candidatar/i });
    expect(applyBtn).toBeEnabled();

    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(screen.getByText(/JobApplicationModal-partner-1/i)).toBeInTheDocument();
    });
  });

  it("mantem candidatura ativa quando aluno ja tem candidatura na empresa e ainda existem vagas abertas", async () => {
    mocks.listOpenVacancies.mockResolvedValue([
      {
        id: "vac-1",
        partner_id: "partner-1",
        available_slots: 1,
      },
      {
        id: "vac-2",
        partner_id: "partner-1",
        available_slots: 1,
      },
    ]);
    mocks.listStudentApplications.mockResolvedValue([
      {
        id: "app-1",
        partner_id: "partner-1",
        status: "PENDING",
      },
    ]);

    render(<PartnersPage />);

    const applyBtn = await screen.findByRole("button", { name: /candidatar/i });
    expect(applyBtn).toBeEnabled();
    expect(applyBtn.className).toContain("secondary");

    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(screen.getByText(/JobApplicationModal-partner-1/i)).toBeInTheDocument();
    });
  });
});
