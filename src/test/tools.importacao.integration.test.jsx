import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import ToolsPage from "../pages/ToolsPage.jsx";

const mocks = vi.hoisted(() => ({
  role: "SUPER_ADMIN",
  search: "?tab=importacao",
  navigate: vi.fn(),
  showToast: vi.fn(),
  importExcelData: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
  useLocation: () => ({ search: mocks.search }),
  useNavigate: () => mocks.navigate,
  useOutletContext: () => ({ showToast: mocks.showToast }),
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

vi.mock("../services/excelImportService.js", () => ({
  importExcelData: (...args) => mocks.importExcelData(...args),
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
  listCoursesByArea: vi.fn().mockResolvedValue([{ id: "course-1", code: "TI", name: "Tecnologias" }]),
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

describe("ToolsPage importacao integration", () => {
  beforeEach(() => {
    mocks.showToast.mockReset();
    mocks.navigate.mockReset();
    mocks.importExcelData.mockReset();
    mocks.search = "?tab=importacao";

    mocks.importExcelData.mockResolvedValue({
      areasCreated: 1,
      coursesCreated: 1,
      classesCreated: 1,
      studentsRegistered: 2,
      studentsUpdated: 1,
      generatedCredentials: [
        {
          row: 2,
          processNumber: "A123",
          fullName: "Aluno Um",
          loginEmail: "aluno.a123@giva.ao",
          password: "Giva!A12312345",
        },
      ],
      errors: ["Linha 4: Email inválido"],
      warnings: ["Linha 5: Número de processo duplicado"],
    });
  });

  it("importa ficheiro e mostra relatorio com botoes de exportacao", async () => {
    const { container } = render(<ToolsPage />);

    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).toBeTruthy();
    const file = new File(["dummy"], "alunos.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    fireEvent.change(fileInput, { target: { files: [file] } });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /importar dados/i })).toBeEnabled();
    });
    fireEvent.click(screen.getByRole("button", { name: /importar dados/i }));

    await waitFor(() => {
      expect(mocks.importExcelData).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/resultados da importação/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /exportar csv de erros e avisos/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /exportar csv das credenciais/i })).toBeInTheDocument();
    });

    expect(mocks.showToast).toHaveBeenCalled();
  });
});
