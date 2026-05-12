import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import UsersManagementPage from "../pages/UsersManagementPage.jsx";

const mocks = vi.hoisted(() => ({
  role: "COORDINATOR",
  showToast: vi.fn(),
  adminListUsers: vi.fn(),
  from: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
  useOutletContext: () => ({ showToast: mocks.showToast }),
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

vi.mock("../contexts/AuthContext.jsx", () => ({
  useAuth: () => ({ authProfile: { role: mocks.role } }),
}));

vi.mock("../services/usersAdminService.js", async () => {
  const actual = await vi.importActual("../services/usersAdminService.js");
  return {
    ...actual,
    adminListUsers: mocks.adminListUsers,
    adminEnsureAccountTypeArtifacts: vi.fn(),
    adminSetUserRole: vi.fn(),
    adminSetUserArea: vi.fn(),
    adminUpdateUserProfile: vi.fn(),
    adminCreatePlatformUser: vi.fn(),
    adminDeleteUser: vi.fn(),
    adminSendPasswordReset: vi.fn(),
  };
});

vi.mock("../services/trainingAreaService.js", () => ({
  listTrainingAreas: vi.fn().mockResolvedValue([]),
}));

vi.mock("../services/profilesService.js", () => ({
  uploadAvatar: vi.fn(),
}));

vi.mock("../lib/supabase.js", () => ({
  supabase: {
    from: mocks.from,
  },
}));

describe("UsersManagementPage security actions", () => {
  beforeEach(() => {
    mocks.showToast.mockReset();
    mocks.from.mockReset();
    mocks.role = "COORDINATOR";

    mocks.adminListUsers.mockResolvedValue([
      {
        id: "u-1",
        display_name: "Aluno Um",
        email: "aluno@example.com",
        type: "student",
        role: "authenticated",
        moderation: "active",
        created_at: new Date().toISOString(),
      },
    ]);
  });

  it("nega ação sensível de moderação para não SUPER_ADMIN", async () => {
    render(<UsersManagementPage embedded showToast={mocks.showToast} />);

    const suspendButton = await screen.findByRole("button", { name: /suspender/i });
    fireEvent.click(suspendButton);

    await waitFor(() => {
      expect(mocks.showToast).toHaveBeenCalledWith(
        "Permissão insuficiente para alterar moderação.",
        "error"
      );
    });

    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("oculta ações de edição/eliminação para não SUPER_ADMIN", async () => {
    render(<UsersManagementPage embedded showToast={mocks.showToast} />);

    await screen.findByText(/aluno um/i);

    expect(screen.queryByRole("button", { name: /editar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /eliminar conta/i })).not.toBeInTheDocument();
  });
});
