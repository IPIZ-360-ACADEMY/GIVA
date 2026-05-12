import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AdminPage from "../pages/AdminPage.jsx";

const mocks = vi.hoisted(() => ({
  role: "COORDINATOR",
}));

vi.mock("react-router-dom", () => ({
  useOutletContext: () => ({ showToast: vi.fn() }),
  useNavigate: () => vi.fn(),
}));

vi.mock("../contexts/AuthContext.jsx", () => ({
  useAuth: () => ({
    authProfile: { role: mocks.role, display_name: "Coord" },
    user: { id: "u-1" },
  }),
}));

vi.mock("../components/PageHeader.jsx", () => ({
  default: ({ title, subtitle }) => (
    <header>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </header>
  ),
}));

describe("AdminPage security view", () => {
  it("mostra bloqueio para perfil não SUPER_ADMIN", () => {
    mocks.role = "COORDINATOR";
    render(<AdminPage />);

    expect(screen.getByRole("heading", { name: /painel de administração/i })).toBeInTheDocument();
    expect(screen.getByText(/área restrita a super admin/i)).toBeInTheDocument();
    expect(screen.getByText(/não tem permissão para aceder a esta área/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /aprovar/i })).not.toBeInTheDocument();
  });
});
