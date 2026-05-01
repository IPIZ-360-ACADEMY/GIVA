import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import InternshipsPage from "../pages/InternshipsPage.jsx";

const mocks = vi.hoisted(() => ({
  auth: {
    user: { id: "user-1", email: "estudante.demo@giva.ao" },
    userProfile: {
      id: "user-1",
      type: "student",
      display_name: "Aluno Demo",
      student_accounts: { process_number: "PROC-001" },
    },
    authProfile: { role: "STUDENT" },
    loading: false,
  },
  listInternships: vi.fn(),
  listProfilesByType: vi.fn(),
  adminListUsers: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
  useOutletContext: () => ({
    showToast: mocks.showToast,
    t: (key) => {
      const labels = {
        "internships.title": "Estagios",
        "internships.description": "Descricao",
        "internships.priorityList": "Lista",
        "internships.classListTitle": "Turmas",
        "internships.filter": "Filtro",
        "internships.all": "Todos",
        "internships.active": "Ativo",
        "internships.monitoring": "Acompanhamento",
        "internships.risk": "Risco",
        "internships.schoolYear": "Ano letivo",
        "internships.class": "Turma",
        "internships.allYears": "Todos os anos",
        "internships.allClasses": "Todas as turmas",
        "internships.loading": "A carregar estágios...",
        "internships.sortBy": "Ordenar",
        "internships.sortGrade": "Nota",
        "internships.sortDate": "Data",
        "internships.sortName": "Nome",
        "internships.itemsPerPage": "Itens",
        "internships.studentsCount": "alunos",
        "internships.startDate": "Inicio",
        "internships.internshipGrade": "Nota",
        "internships.lastUpdate": "Ultima atualizacao",
        "internships.supervisor": "Supervisor",
        "internships.emptyClasses": "Sem turmas",
        "common.student": "Aluno",
        "common.course": "Curso",
        "common.company": "Empresa",
        "common.status": "Estado",
        "common.action": "Acao",
        "common.details": "Detalhes",
      };
      return labels[key] ?? key;
    },
  }),
}));

vi.mock("../contexts/AuthContext.jsx", async (importOriginal) => {
  const actual = await importOriginal();
  const { resolveAccessProfile } = await import("../utils/accessControl.js");
  return {
    ...actual,
    useAuth: () => mocks.auth,
    useAccessProfile: () => resolveAccessProfile({
      role: mocks.auth.authProfile?.role,
      type: mocks.auth.userProfile?.type,
    }),
  };
});

vi.mock("../components/PageHeader.jsx", () => ({
  default: ({ title, meta }) => (
    <header>
      <h1>{title}</h1>
      {meta}
    </header>
  ),
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
  default: ({ rows }) => (
    <div>
      {rows.map((row) => (
        <div key={row.id} data-testid={`internship-${row.id}`}>
          <span>{row.aluno}</span>
          <span>{row.empresa}</span>
          <span>{row.processo}</span>
        </div>
      ))}
    </div>
  ),
}));

vi.mock("../components/StudentProfileModal.jsx", () => ({
  default: () => null,
}));

vi.mock("../services/internshipsService.js", () => ({
  canUseInternshipsApi: () => true,
  listInternships: mocks.listInternships,
}));

vi.mock("../services/profilesService.js", () => ({
  listProfilesByType: mocks.listProfilesByType,
}));

vi.mock("../services/usersAdminService.js", () => ({
  adminListUsers: mocks.adminListUsers,
}));

describe("InternshipsPage visibility by role", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listProfilesByType.mockResolvedValue([]);
    mocks.adminListUsers.mockResolvedValue([]);
  });

  it("mostra ao aluno apenas os estagios do proprio processo", async () => {
    mocks.auth.userProfile = {
      id: "user-1",
      type: "student",
      display_name: "Aluno Demo",
      student_accounts: { process_number: "PROC-001" },
    };
    mocks.auth.authProfile = { role: "STUDENT" };

    mocks.listInternships.mockResolvedValue([
      {
        id: "i-1",
        aluno: "Aluno Demo",
        processo: "PROC-001",
        empresa: "Empresa A",
        turma: "11-TI-A",
        anoLetivo: "2025/2026",
        curso: "TI",
        inicio: "01 Jan 2026",
        nota: "15",
        status: "active",
        supervisor: "Sup 1",
        ultimaAtualizacao: "01 Jan 2026",
        photo: "",
      },
      {
        id: "i-2",
        aluno: "Outro Aluno",
        processo: "PROC-999",
        empresa: "Empresa B",
        turma: "11-TI-A",
        anoLetivo: "2025/2026",
        curso: "TI",
        inicio: "01 Jan 2026",
        nota: "16",
        status: "active",
        supervisor: "Sup 2",
        ultimaAtualizacao: "01 Jan 2026",
        photo: "",
      },
    ]);

    render(<InternshipsPage />);

    await waitFor(() => {
      expect(screen.getByTestId("internship-i-1")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("internship-i-2")).not.toBeInTheDocument();
    expect(mocks.listProfilesByType).not.toHaveBeenCalled();
  });

  it("mostra a empresa apenas estagios da propria empresa", async () => {
    mocks.auth.userProfile = {
      id: "company-1",
      type: "company",
      display_name: "Empresa Demo GIVA",
      company_accounts: { empresa: "Empresa Demo GIVA" },
    };
    mocks.auth.authProfile = { role: "COMPANY" };

    mocks.listInternships.mockResolvedValue([
      {
        id: "i-3",
        aluno: "Aluno 1",
        processo: "PROC-003",
        empresa: "Empresa Demo GIVA",
        turma: "12-EIE-B",
        anoLetivo: "2025/2026",
        curso: "EIE",
        inicio: "01 Jan 2026",
        nota: "14",
        status: "monitoring",
        supervisor: "Sup 3",
        ultimaAtualizacao: "01 Jan 2026",
        photo: "",
      },
      {
        id: "i-4",
        aluno: "Aluno 2",
        processo: "PROC-004",
        empresa: "Empresa Externa",
        turma: "12-EIE-B",
        anoLetivo: "2025/2026",
        curso: "EIE",
        inicio: "01 Jan 2026",
        nota: "13",
        status: "active",
        supervisor: "Sup 4",
        ultimaAtualizacao: "01 Jan 2026",
        photo: "",
      },
    ]);

    render(<InternshipsPage />);

    await waitFor(() => {
      expect(screen.getByTestId("internship-i-3")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("internship-i-4")).not.toBeInTheDocument();
    expect(mocks.listProfilesByType).not.toHaveBeenCalled();
  });
});
