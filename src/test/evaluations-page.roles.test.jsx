import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EvaluationsPage from "../pages/EvaluationsPageEnhanced.jsx";

const mocks = vi.hoisted(() => ({
  accessProfile: { isSuperAdmin: true },
  userProfile: { id: "u-admin", role: "SUPER_ADMIN" },
}));

vi.mock("react-router-dom", () => ({
  useOutletContext: () => ({
    t: (key) => key,
  }),
}));

vi.mock("../contexts/AuthContext.jsx", () => ({
  useAuth: () => ({
    userProfile: mocks.userProfile,
  }),
  useAccessProfile: () => mocks.accessProfile,
}));

vi.mock("../components/PageHeader.jsx", () => ({
  default: ({ title, description }) => (
    <header>
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  ),
}));

vi.mock("../components/evaluations/EvalDashboardAdmin.jsx", () => ({
  default: ({ activeTab }) => <div>admin:{activeTab}</div>,
}));

vi.mock("../components/evaluations/EvalDashboardCoordinator.jsx", () => ({
  default: ({ activeTab }) => <div>coord:{activeTab}</div>,
}));

vi.mock("../components/evaluations/EvalDashboardTeacher.jsx", () => ({
  default: ({ activeTab }) => <div>teacher:{activeTab}</div>,
}));

vi.mock("../components/evaluations/EvalDashboardStudent.jsx", () => ({
  default: ({ activeTab }) => <div>student:{activeTab}</div>,
}));

vi.mock("../components/evaluations/EvalDashboardCompany.jsx", () => ({
  default: ({ activeTab }) => <div>company:{activeTab}</div>,
}));

describe("EvaluationsPage multi-view by role", () => {
  beforeEach(() => {
    mocks.accessProfile = { isSuperAdmin: true };
    mocks.userProfile = { id: "u-admin", role: "SUPER_ADMIN" };
  });

  it("renderiza visão admin com tabs de gestão avançada", () => {
    render(<EvaluationsPage />);

    expect(screen.getByRole("tab", { name: "Visão Geral" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Exportar" })).toBeInTheDocument();
    expect(screen.getByText("admin:overview")).toBeInTheDocument();
  });

  it("renderiza visão coordinator sem tab de lançamento", () => {
    mocks.accessProfile = { isCoordinatorUser: true };
    mocks.userProfile = { id: "u-coord", role: "COORDINATOR" };

    render(<EvaluationsPage />);

    expect(screen.getByRole("tab", { name: "Minha Área" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Lançar Nota" })).not.toBeInTheDocument();
    expect(screen.getByText("coord:area-overview")).toBeInTheDocument();
  });

  it("permite alternar tab na visão teacher", () => {
    mocks.accessProfile = { isTeacherUser: true };
    mocks.userProfile = { id: "u-teacher", role: "TEACHER" };

    render(<EvaluationsPage />);

    const launchTab = screen.getByRole("tab", { name: "Lançar Nota" });
    fireEvent.click(launchTab);

    expect(launchTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("teacher:grade-entry")).toBeInTheDocument();
  });

  it("renderiza visão student com histórico", () => {
    mocks.accessProfile = { isStudentUser: true };
    mocks.userProfile = { id: "u-student", role: "STUDENT" };

    render(<EvaluationsPage />);

    expect(screen.getByRole("tab", { name: "Minhas Avaliações" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Histórico" })).toBeInTheDocument();
    expect(screen.getByText("student:mine")).toBeInTheDocument();
  });

  it("renderiza visão company", () => {
    mocks.accessProfile = { isCompanyUser: true };
    mocks.userProfile = { id: "u-company", role: "COMPANY" };

    render(<EvaluationsPage />);

    expect(screen.getByRole("tab", { name: "Avaliações de Estágio" })).toBeInTheDocument();
    expect(screen.getByText("company:intern-evals")).toBeInTheDocument();
  });

  it("fallback sem perfil cai para visão mínima de estudante", () => {
    mocks.accessProfile = null;
    mocks.userProfile = { id: "u-external", role: "EXTERNAL" };

    render(<EvaluationsPage />);

    expect(screen.getByRole("tab", { name: "Minhas Avaliações" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Histórico" })).not.toBeInTheDocument();
    expect(screen.getByText("student:mine")).toBeInTheDocument();
  });
});
