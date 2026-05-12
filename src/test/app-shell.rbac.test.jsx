import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppShell from "../components/AppShell.jsx";

const authState = vi.hoisted(() => ({
  value: {
    authEnabled: true,
    authProfile: { role: "TEACHER", displayName: "Ada Lovelace" },
    userProfile: { type: "teacher", display_name: "Ada Lovelace", avatar_url: null },
    user: { id: "user-1" },
    signOut: vi.fn(),
    notifCount: 0,
  },
}));

vi.mock("../contexts/AuthContext.jsx", () => ({
  useAuth: () => authState.value,
}));

vi.mock("../services/chatService.js", () => ({
  getUnreadCount: vi.fn().mockResolvedValue(0),
  subscribeToConversations: vi.fn(() => vi.fn()),
}));

vi.mock("../components/NotifToast.jsx", () => ({
  default: () => null,
}));

vi.mock("../components/TopProgressBar.jsx", () => ({
  default: () => null,
}));

function renderShell() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<h1>Dashboard</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

function getMainMenu() {
  return screen.getByRole("navigation", { name: /menu principal|main menu/i });
}

describe("AppShell RBAC navigation", () => {
  beforeEach(() => {
    window.localStorage.clear();
    authState.value.signOut.mockReset();
  });

  it("mostra navegação académica para professor sem links administrativos", async () => {
    authState.value = {
      ...authState.value,
      authProfile: { role: "TEACHER", displayName: "Ada Lovelace" },
      userProfile: { type: "teacher", display_name: "Ada Lovelace", avatar_url: null },
      notifCount: 0,
    };

    renderShell();

    await waitFor(() => {
      const menu = getMainMenu();
      expect(within(menu).getByRole("link", { name: /avalia/i })).toBeInTheDocument();
      expect(within(menu).getByRole("link", { name: /turmas/i })).toBeInTheDocument();
      expect(within(menu).queryByRole("link", { name: /administra/i })).not.toBeInTheDocument();
      expect(within(menu).queryByRole("link", { name: /ferramentas/i })).not.toBeInTheDocument();
    });
  });

  it("mostra navegação reduzida para empresa", async () => {
    authState.value = {
      ...authState.value,
      authProfile: { role: "COMPANY", displayName: "Empresa Demo" },
      userProfile: { type: "company", display_name: "Empresa Demo", avatar_url: null },
      notifCount: 3,
    };

    renderShell();

    await waitFor(() => {
      const menu = getMainMenu();
      expect(within(menu).getByRole("link", { name: /empresa/i })).toBeInTheDocument();
      expect(within(menu).getByRole("link", { name: /candidaturas rbac/i })).toBeInTheDocument();
      expect(within(menu).queryByRole("link", { name: /avalia/i })).not.toBeInTheDocument();
      expect(within(menu).queryByRole("link", { name: /turmas/i })).not.toBeInTheDocument();
    });
  });
});