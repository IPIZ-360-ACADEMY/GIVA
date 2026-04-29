import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import RequireAuth from "../components/RequireAuth.jsx";

const authState = vi.hoisted(() => ({
  value: {
    authEnabled: true,
    isAuthenticated: true,
    loading: false,
    user: { id: "u-1" },
    userProfile: { type: "student", moderation: "active" },
    authProfile: { role: "STUDENT" },
  },
}));

vi.mock("../contexts/AuthContext.jsx", () => ({
  useAuth: () => authState.value,
}));

vi.mock("../services/authService.js", () => ({
  signOut: vi.fn(),
}));

function renderWithPath(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<RequireAuth />}>
          <Route path="/" element={<h1>Dashboard</h1>} />
          <Route path="/home" element={<h1>Feed</h1>} />
          <Route path="/parceiros" element={<h1>Parceiros</h1>} />
          <Route path="/estagios" element={<h1>Estagios</h1>} />
          <Route path="/config" element={<h1>Configuracoes</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe("RequireAuth RBAC", () => {
  it("redireciona estudante de /parceiros para dashboard", async () => {
    authState.value = {
      authEnabled: true,
      isAuthenticated: true,
      loading: false,
      user: { id: "u-student" },
      userProfile: { type: "student", moderation: "active" },
      authProfile: { role: "STUDENT" },
    };

    renderWithPath("/parceiros");

    expect(await screen.findByRole("heading", { name: /dashboard/i })).toBeInTheDocument();
  });

  it("permite estudante em /estagios", async () => {
    authState.value = {
      authEnabled: true,
      isAuthenticated: true,
      loading: false,
      user: { id: "u-student" },
      userProfile: { type: "student", moderation: "active" },
      authProfile: { role: "STUDENT" },
    };

    renderWithPath("/estagios");

    expect(await screen.findByRole("heading", { name: /estagios/i })).toBeInTheDocument();
  });

  it("redireciona perfil externo para /home quando tenta acessar outras rotas", async () => {
    authState.value = {
      authEnabled: true,
      isAuthenticated: true,
      loading: false,
      user: { id: "u-external" },
      userProfile: { type: "external", moderation: "active" },
      authProfile: { role: "authenticated" },
    };

    renderWithPath("/parceiros");

    expect(await screen.findByRole("heading", { name: /feed/i })).toBeInTheDocument();
  });

  it("permite perfil externo em /config", async () => {
    authState.value = {
      authEnabled: true,
      isAuthenticated: true,
      loading: false,
      user: { id: "u-external" },
      userProfile: { type: "external", moderation: "active" },
      authProfile: { role: "authenticated" },
    };

    renderWithPath("/config");

    expect(await screen.findByRole("heading", { name: /configuracoes/i })).toBeInTheDocument();
  });
});
