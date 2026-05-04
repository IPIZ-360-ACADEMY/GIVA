import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import ToolsPage from "../pages/ToolsPage.jsx";

const mocks = vi.hoisted(() => ({
  role: "SUPER_ADMIN",
}));

vi.mock("react-router-dom", () => ({
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
  useLocation: () => ({ search: "" }),
  useNavigate: () => vi.fn(),
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
});
