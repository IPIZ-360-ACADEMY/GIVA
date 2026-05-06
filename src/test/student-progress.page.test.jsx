import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import StudentProgressPage from "../pages/StudentProgressPage.jsx";

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useOutletContext: () => ({ t: (key) => key }),
  };
});

vi.mock("../components/CompanyProgressTimeline.jsx", () => ({
  default: ({ partnerId }) => <div>timeline:{partnerId}</div>,
}));

vi.mock("../contexts/AuthContext.jsx", () => ({
  useAuth: () => ({ user: { id: "student-auth-1" } }),
  useAccessProfile: () => ({ isAdmin: false, isCompanyUser: false }),
}));

vi.mock("../services/companyProgressService.js", () => ({
  listStudentProgressByPartner: vi.fn(async () => ([
    {
      id: "progress-1",
      partner: { id: "partner-1", empresa: "Empresa XPTO" },
      progression_stage: "COMPLETED",
      progress_status: "COMPLETED",
    },
  ])),
}));

describe("StudentProgressPage", () => {
  it("carrega o progresso do aluno a partir de company_progress, incluindo processos concluidos", async () => {
    render(
      <MemoryRouter initialEntries={["/progresso"]}>
        <Routes>
          <Route
            path="/progresso"
            element={<StudentProgressPage />}
          />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "progressCompany.title" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Empresa XPTO" })).toBeInTheDocument();
      expect(screen.getByText("timeline:partner-1")).toBeInTheDocument();
    });
  });
});