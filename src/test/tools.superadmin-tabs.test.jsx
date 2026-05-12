import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import ToolsPage, { canAccessToolsTab, resolveRequestedToolsTab, resolveVisibleToolTabs } from "../pages/ToolsPage.jsx";

const mocks = vi.hoisted(() => ({
  role: "SUPER_ADMIN",
  search: "",
  navigate: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
  useLocation: () => ({ search: mocks.search }),
  useNavigate: () => mocks.navigate,
  useOutletContext: () => ({ showToast: vi.fn() }),
}));

vi.mock("../components/PageHeader.jsx", () => ({
  default: ({ title, subtitle }) => (
    <header>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </header>
  ),
}));

vi.mock("../contexts/AuthContext.jsx", () => ({
  useAuth: () => ({
    authProfile: {
      role: mocks.role,
      areaId: "area-1",
    },
  }),
}));

vi.mock("../services/internshipsService.js", () => ({
  canUseInternshipsApi: () => true,
  listInternships: vi.fn().mockResolvedValue([]),
}));

vi.mock("../services/classesService.js", () => ({
  listManualClasses: vi.fn().mockResolvedValue([]),
  createManualClass: vi.fn().mockResolvedValue({ id: "class-1" }),
}));

vi.mock("../services/trainingAreaService.js", () => ({
  listTrainingAreas: vi.fn().mockResolvedValue([{ id: "area-1", code: "INFO", name: "Informática" }]),
  createTrainingArea: vi.fn(),
  listCoursesByArea: vi.fn().mockResolvedValue([{ id: "course-1", code: "TI", name: "Tecnologias de Informação" }]),
  createCourse: vi.fn(),
  updateTrainingArea: vi.fn(),
  updateCourse: vi.fn(),
}));

vi.mock("../services/partnersService.js", () => ({
  listPartners: vi.fn().mockResolvedValue([]),
}));

vi.mock("../services/jobApplicationService.js", () => ({
  acceptJobApplication: vi.fn(),
  rejectJobApplication: vi.fn(),
}));

const supabaseChain = {
  select: vi.fn(() => supabaseChain),
  order: vi.fn(() => Promise.resolve({ data: [] })),
  eq: vi.fn(() => supabaseChain),
  not: vi.fn(() => supabaseChain),
  limit: vi.fn(() => supabaseChain),
  maybeSingle: vi.fn(() => Promise.resolve({ data: null })),
  then: undefined,
};

vi.mock("../lib/supabase.js", () => ({
  supabase: {
    from: vi.fn(() => supabaseChain),
  },
}));

describe("ToolsPage role tabs", () => {
  beforeEach(() => {
    mocks.search = "";
    mocks.navigate.mockReset();
  });

  it("mostra tabs extras para SUPER_ADMIN", async () => {
    mocks.role = "SUPER_ADMIN";
    render(<ToolsPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /orquestração/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /áreas e cursos/i })).toBeInTheDocument();
    });
  });

  it("oculta tabs extras para COORDINATOR", async () => {
    mocks.role = "COORDINATOR";
    render(<ToolsPage />);

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /orquestração/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /áreas e cursos/i })).not.toBeInTheDocument();
    });
  });

  it("rejeita tab utilzadores para coordenador e normaliza para a primeira tab visível", async () => {
    mocks.role = "COORDINATOR";
    mocks.search = "?tab=utilizadores";
    render(<ToolsPage />);

    await waitFor(() => {
      expect(mocks.navigate).toHaveBeenCalledWith("/ferramentas?tab=alunos", { replace: true });
    });

    expect(screen.queryByRole("button", { name: /utilizadores/i })).not.toBeInTheDocument();
  });

  it("bloqueia visualização da página para role sem acesso administrativo", async () => {
    mocks.role = "TEACHER";
    render(<ToolsPage />);

    await waitFor(() => {
      expect(screen.getByText(/não tem permissão para aceder a esta área/i)).toBeInTheDocument();
    });
  });

  it("navega para tab permitida quando coordenador interage com o separador", async () => {
    mocks.role = "COORDINATOR";
    render(<ToolsPage />);

    const pautasTab = await screen.findByRole("button", { name: /pautas por turma/i });
    await act(async () => {
      fireEvent.click(pautasTab);
    });

    expect(mocks.navigate).toHaveBeenCalledWith("/ferramentas?tab=pautas", { replace: true });
  });
});

describe("ToolsPage tab resolution helpers", () => {
  it("inclui tabs privilegiadas apenas para SUPER_ADMIN", () => {
    expect(resolveVisibleToolTabs("SUPER_ADMIN").map((tab) => tab.id)).toContain("utilizadores");
    expect(resolveVisibleToolTabs("COORDINATOR").map((tab) => tab.id)).not.toContain("utilizadores");
  });

  it("normaliza tabs pedidas para fallback quando não estão visíveis", () => {
    const visibleTabs = resolveVisibleToolTabs("COORDINATOR");
    expect(resolveRequestedToolsTab("utilizadores", visibleTabs, "alunos")).toBe("alunos");
    expect(resolveRequestedToolsTab("pautas", visibleTabs, "alunos")).toBe("pautas");
  });

  it("valida acesso por separador conforme role", () => {
    expect(canAccessToolsTab("SUPER_ADMIN", "utilizadores")).toBe(true);
    expect(canAccessToolsTab("COORDINATOR", "utilizadores")).toBe(false);
    expect(canAccessToolsTab("COORDINATOR", "pautas")).toBe(true);
  });
});
