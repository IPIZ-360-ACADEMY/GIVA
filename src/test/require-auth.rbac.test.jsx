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
          <Route path="/avaliacoes" element={<h1>Avaliacoes</h1>} />
          <Route path="/turmas" element={<h1>Turmas</h1>} />
          <Route path="/areas-formacao" element={<h1>Areas</h1>} />
          <Route path="/empresa" element={<h1>Empresa</h1>} />
          <Route path="/admin" element={<h1>Admin</h1>} />
          <Route path="/ferramentas" element={<h1>Ferramentas</h1>} />
          <Route path="/rbac/vagas" element={<h1>Vagas</h1>} />
          <Route path="/rbac/candidaturas" element={<h1>Candidaturas</h1>} />
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

describe("RequireAuth RBAC — ADMIN_1", () => {
  function asAdmin1() {
    authState.value = {
      authEnabled: true,
      isAuthenticated: true,
      loading: false,
      user: { id: "u-admin1" },
      userProfile: { type: "admin", moderation: "active" },
      authProfile: { role: "ADMIN_1" },
    };
  }

  it("permite ADMIN_1 em /admin", async () => {
    asAdmin1();
    renderWithPath("/admin");
    expect(await screen.findByRole("heading", { name: /admin/i })).toBeInTheDocument();
  });

  it("permite ADMIN_1 em /ferramentas", async () => {
    asAdmin1();
    renderWithPath("/ferramentas");
    expect(await screen.findByRole("heading", { name: /ferramentas/i })).toBeInTheDocument();
  });

  it("permite ADMIN_1 em /estagios", async () => {
    asAdmin1();
    renderWithPath("/estagios");
    expect(await screen.findByRole("heading", { name: /estagios/i })).toBeInTheDocument();
  });

  it("permite ADMIN_1 em /parceiros", async () => {
    asAdmin1();
    renderWithPath("/parceiros");
    expect(await screen.findByRole("heading", { name: /parceiros/i })).toBeInTheDocument();
  });

  it("permite ADMIN_1 em /turmas", async () => {
    asAdmin1();
    renderWithPath("/turmas");
    expect(await screen.findByRole("heading", { name: /turmas/i })).toBeInTheDocument();
  });
});

describe("RequireAuth RBAC — SUPER_ADMIN", () => {
  function asSuperAdmin() {
    authState.value = {
      authEnabled: true,
      isAuthenticated: true,
      loading: false,
      user: { id: "u-super" },
      userProfile: { type: "admin", moderation: "active" },
      authProfile: { role: "SUPER_ADMIN" },
    };
  }

  it("permite SUPER_ADMIN em /admin", async () => {
    asSuperAdmin();
    renderWithPath("/admin");
    expect(await screen.findByRole("heading", { name: /admin/i })).toBeInTheDocument();
  });

  it("permite SUPER_ADMIN em /ferramentas", async () => {
    asSuperAdmin();
    renderWithPath("/ferramentas");
    expect(await screen.findByRole("heading", { name: /ferramentas/i })).toBeInTheDocument();
  });

  it("permite SUPER_ADMIN em /empresa", async () => {
    asSuperAdmin();
    renderWithPath("/empresa");
    expect(await screen.findByRole("heading", { name: /empresa/i })).toBeInTheDocument();
  });
});

describe("RequireAuth RBAC — Empresa", () => {
  function asCompany() {
    authState.value = {
      authEnabled: true,
      isAuthenticated: true,
      loading: false,
      user: { id: "u-company" },
      userProfile: { type: "company", moderation: "active" },
      authProfile: { role: "COMPANY" },
    };
  }

  it("permite empresa em /empresa", async () => {
    asCompany();
    renderWithPath("/empresa");
    expect(await screen.findByRole("heading", { name: /empresa/i })).toBeInTheDocument();
  });

  it("bloqueia empresa em /ferramentas", async () => {
    asCompany();
    renderWithPath("/ferramentas");
    expect(await screen.findByRole("heading", { name: /empresa/i })).toBeInTheDocument();
  });

  it("bloqueia empresa em /estagios", async () => {
    asCompany();
    renderWithPath("/estagios");
    expect(await screen.findByRole("heading", { name: /empresa/i })).toBeInTheDocument();
  });

  it("permite empresa em /rbac/candidaturas", async () => {
    asCompany();
    renderWithPath("/rbac/candidaturas");
    expect(await screen.findByRole("heading", { name: /candidaturas/i })).toBeInTheDocument();
  });
});

describe("RequireAuth RBAC — Coordenador", () => {
  function asCoordinator() {
    authState.value = {
      authEnabled: true,
      isAuthenticated: true,
      loading: false,
      user: { id: "u-coord" },
      userProfile: { type: "coordinator", moderation: "active" },
      authProfile: { role: "COORDINATOR" },
    };
  }

  it("permite coordenador em /turmas", async () => {
    asCoordinator();
    renderWithPath("/turmas");
    expect(await screen.findByRole("heading", { name: /turmas/i })).toBeInTheDocument();
  });

  it("permite coordenador em /avaliacoes", async () => {
    asCoordinator();
    renderWithPath("/avaliacoes");
    expect(await screen.findByRole("heading", { name: /avaliacoes/i })).toBeInTheDocument();
  });

  it("bloqueia coordenador em /ferramentas", async () => {
    asCoordinator();
    renderWithPath("/ferramentas");
    expect(await screen.findByRole("heading", { name: /dashboard/i })).toBeInTheDocument();
  });

  it("bloqueia coordenador em /admin", async () => {
    asCoordinator();
    renderWithPath("/admin");
    expect(await screen.findByRole("heading", { name: /dashboard/i })).toBeInTheDocument();
  });
});

describe("RequireAuth RBAC — ADMIN_1", () => {
  function asAdmin1() {
    authState.value = {
      authEnabled: true,
      isAuthenticated: true,
      loading: false,
      user: { id: "u-admin1" },
      userProfile: { type: "admin", moderation: "active" },
      authProfile: { role: "ADMIN_1" },
    };
  }

  it("permite ADMIN_1 em /admin", async () => {
    asAdmin1();
    renderWithPath("/admin");
    expect(await screen.findByRole("heading", { name: /admin/i })).toBeInTheDocument();
  });

  it("permite ADMIN_1 em /ferramentas", async () => {
    asAdmin1();
    renderWithPath("/ferramentas");
    expect(await screen.findByRole("heading", { name: /ferramentas/i })).toBeInTheDocument();
  });

  it("permite ADMIN_1 em /estagios", async () => {
    asAdmin1();
    renderWithPath("/estagios");
    expect(await screen.findByRole("heading", { name: /estagios/i })).toBeInTheDocument();
  });

  it("permite ADMIN_1 em /parceiros", async () => {
    asAdmin1();
    renderWithPath("/parceiros");
    expect(await screen.findByRole("heading", { name: /parceiros/i })).toBeInTheDocument();
  });

  it("permite ADMIN_1 em /turmas", async () => {
    asAdmin1();
    renderWithPath("/turmas");
    expect(await screen.findByRole("heading", { name: /turmas/i })).toBeInTheDocument();
  });
});

describe("RequireAuth RBAC — SUPER_ADMIN", () => {
  function asSuperAdmin() {
    authState.value = {
      authEnabled: true,
      isAuthenticated: true,
      loading: false,
      user: { id: "u-super" },
      userProfile: { type: "admin", moderation: "active" },
      authProfile: { role: "SUPER_ADMIN" },
    };
  }

  it("permite SUPER_ADMIN em /admin", async () => {
    asSuperAdmin();
    renderWithPath("/admin");
    expect(await screen.findByRole("heading", { name: /admin/i })).toBeInTheDocument();
  });

  it("permite SUPER_ADMIN em /ferramentas", async () => {
    asSuperAdmin();
    renderWithPath("/ferramentas");
    expect(await screen.findByRole("heading", { name: /ferramentas/i })).toBeInTheDocument();
  });

  it("permite SUPER_ADMIN em /empresa", async () => {
    asSuperAdmin();
    renderWithPath("/empresa");
    expect(await screen.findByRole("heading", { name: /empresa/i })).toBeInTheDocument();
  });
});

describe("RequireAuth RBAC — Empresa", () => {
  function asCompany() {
    authState.value = {
      authEnabled: true,
      isAuthenticated: true,
      loading: false,
      user: { id: "u-company" },
      userProfile: { type: "company", moderation: "active" },
      authProfile: { role: "COMPANY" },
    };
  }

  it("permite empresa em /empresa", async () => {
    asCompany();
    renderWithPath("/empresa");
    expect(await screen.findByRole("heading", { name: /empresa/i })).toBeInTheDocument();
  });

  it("bloqueia empresa em /ferramentas", async () => {
    asCompany();
    renderWithPath("/ferramentas");
    expect(await screen.findByRole("heading", { name: /empresa/i })).toBeInTheDocument();
  });

  it("bloqueia empresa em /estagios", async () => {
    asCompany();
    renderWithPath("/estagios");
    expect(await screen.findByRole("heading", { name: /empresa/i })).toBeInTheDocument();
  });

  it("permite empresa em /rbac/candidaturas", async () => {
    asCompany();
    renderWithPath("/rbac/candidaturas");
    expect(await screen.findByRole("heading", { name: /candidaturas/i })).toBeInTheDocument();
  });
});

describe("RequireAuth RBAC — Coordenador", () => {
  function asCoordinator() {
    authState.value = {
      authEnabled: true,
      isAuthenticated: true,
      loading: false,
      user: { id: "u-coord" },
      userProfile: { type: "coordinator", moderation: "active" },
      authProfile: { role: "COORDINATOR" },
    };
  }

  it("permite coordenador em /turmas", async () => {
    asCoordinator();
    renderWithPath("/turmas");
    expect(await screen.findByRole("heading", { name: /turmas/i })).toBeInTheDocument();
  });

  it("permite coordenador em /avaliacoes", async () => {
    asCoordinator();
    renderWithPath("/avaliacoes");
    expect(await screen.findByRole("heading", { name: /avaliacoes/i })).toBeInTheDocument();
  });

  it("bloqueia coordenador em /ferramentas", async () => {
    asCoordinator();
    renderWithPath("/ferramentas");
    expect(await screen.findByRole("heading", { name: /dashboard/i })).toBeInTheDocument();
  });

  it("bloqueia coordenador em /admin", async () => {
    asCoordinator();
    renderWithPath("/admin");
    expect(await screen.findByRole("heading", { name: /dashboard/i })).toBeInTheDocument();
  });
});
