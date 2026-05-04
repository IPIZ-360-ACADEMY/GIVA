import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../App.jsx";

const normalizeText = (value = "") =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const nameIncludes = (expected) => (accessibleName) =>
  normalizeText(accessibleName).includes(normalizeText(expected));

function renderWithRoute(route, preferences) {
  if (preferences) {
    window.localStorage.setItem("giva.preferences", JSON.stringify(preferences));
  }

  return render(
    <MemoryRouter
      initialEntries={[route]}
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <App />
    </MemoryRouter>
  );
}

describe("App routes", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renderiza dashboard na rota raiz", async () => {
    renderWithRoute("/");
    await waitFor(() => {
      const mainMenu = screen.getByRole("navigation", { name: /menu principal/i });
      const dashboardLink = within(mainMenu).getByRole("link", { name: /painel|dashboard/i });
      expect(dashboardLink).toHaveAttribute("aria-current", "page");
    });
  });

  it("renderiza menu traduzido em pt-PT", () => {
    renderWithRoute("/", { language: "pt-PT", uiNotifications: true, density: "comfortable" });
    expect(screen.getByRole("link", { name: /painel/i })).toBeInTheDocument();
  });

  it("renderiza login em ingles quando idioma ativo e en", async () => {
    renderWithRoute("/login", { language: "en", uiNotifications: true, density: "comfortable" });
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /access giva/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
    });
  });

  it("redireciona rota legada /docs para /documentos", async () => {
    renderWithRoute("/docs");
    await waitFor(() => {
      expect(screen.getByRole("region", { name: /explorador documental/i })).toBeInTheDocument();
    });
  });

  it("permite login e navega para dashboard", async () => {
    renderWithRoute("/login");

    fireEvent.change(screen.getByLabelText(/utilizador/i), { target: { value: "admin" } });
    fireEvent.change(screen.getByLabelText(/palavra-passe|password/i), { target: { value: "Admin@2026" } });
    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: nameIncludes("centro operacional de estagios") })).toBeInTheDocument();
    });
  });

  it("permite login e navega para dashboard em ingles", async () => {
    renderWithRoute("/login", { language: "en", uiNotifications: true, density: "comfortable" });

    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: "admin" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "Admin@2026" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /internship operations center/i })).toBeInTheDocument();
    });
    });

  it("renderiza estagios na rota /estagios", async () => {
    renderWithRoute("/estagios");
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: nameIncludes("operacao de estagios ativos") })).toBeInTheDocument();
    });
  });

  it("redireciona rota legada /est para /estagios", async () => {
    renderWithRoute("/est");
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: nameIncludes("operacao de estagios ativos") })).toBeInTheDocument();
    });
  });

  it("renderiza turmas na rota /turmas", async () => {
    renderWithRoute("/turmas");
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: nameIncludes("gestor de turmas") })).toBeInTheDocument();
    });
  });

  it("exibe link para detalhe da turma", async () => {
    renderWithRoute("/turmas");

    const classCard = await screen.findByRole("link", { name: /abrir detalhes da turma: 11-ti-a/i });
    expect(classCard).toHaveAttribute("href");
  });

  it("renderiza detalhe da turma na rota de detalhe", async () => {
    renderWithRoute("/turmas/detalhe?anoLetivo=2025%2F2026&curso=TI&turma=11-TI-A");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: nameIncludes("detalhes da turma") })).toBeInTheDocument();
    });

    expect(screen.getByText(/ana melo/i)).toBeInTheDocument();
    expect(screen.getAllByText(/novasoft/i).length).toBeGreaterThan(0);
  });

  it("renderiza parceiros na rota /parceiros", async () => {
    renderWithRoute("/parceiros");
    expect(await screen.findByRole("heading", { name: nameIncludes("ecossistema de parceiros") }, { timeout: 12000 })).toBeInTheDocument();
  });

  it("redireciona rota legada /parc para /parceiros", async () => {
    renderWithRoute("/parc");
    expect(await screen.findByRole("heading", { name: nameIncludes("ecossistema de parceiros") }, { timeout: 12000 })).toBeInTheDocument();
  });

  it("renderiza avaliacoes na rota /avaliacoes", async () => {
    renderWithRoute("/avaliacoes");
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: nameIncludes("painel de avaliacoes") })).toBeInTheDocument();
    });
  });

  it("renderiza notificacoes na rota /notificacoes", async () => {
    renderWithRoute("/notificacoes");
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: nameIncludes("notificacoes") })).toBeInTheDocument();
    });
  });

  it("redireciona rota legada /notif para /notificacoes", async () => {
    renderWithRoute("/notif");
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: nameIncludes("notificacoes") })).toBeInTheDocument();
    });
  });

  it("nav em ingles inclui link Settings", () => {
    renderWithRoute("/", { language: "en", uiNotifications: true, density: "comfortable" });
    const mainMenu = screen.getByRole("navigation", { name: /main menu/i });
    const settingsLink = within(mainMenu).getByRole("link", { name: /settings/i });
    expect(settingsLink).toBeInTheDocument();
    expect(settingsLink).toHaveAttribute("href", "/config");
  });

  it("dashboard em ingles inclui acao Open Classes", () => {
    renderWithRoute("/", { language: "en", uiNotifications: true, density: "comfortable" });
    const classesLink = screen.getByRole("link", { name: /open classes/i });
    expect(classesLink).toBeInTheDocument();
    expect(classesLink).toHaveAttribute("href", "/turmas");
  });

  it("dashboard exibe painel operacional de candidaturas", async () => {
    renderWithRoute("/");
    await waitFor(() => {
      expect(screen.getByText(/pulso operacional de candidaturas/i)).toBeInTheDocument();
      expect(
        screen.getByText((content) => normalizeText(content).includes("tendencia de candidaturas"))
      ).toBeInTheDocument();
    });
  });

  it("dashboard exibe kpis comparativos por janela", async () => {
    renderWithRoute("/");
    await waitFor(() => {
      expect(screen.getByText(/comparativo 7 dias/i)).toBeInTheDocument();
      expect(screen.getByText(/comparativo 30 dias/i)).toBeInTheDocument();
      expect(screen.getByText(/comparativo 90 dias/i)).toBeInTheDocument();
    });
  });

  it("renderiza painel empresa na rota /empresa", async () => {
    renderWithRoute("/empresa");
    await waitFor(() => {
      // Sem Supabase, o componente mostra estado noPartner ou o titulo
      const heading = screen.queryByRole("heading", { name: /painel da empresa/i }) ||
        screen.queryByText(/painel da empresa/i) ||
        screen.queryByText(/nenhum registo de empresa/i);
      expect(heading).toBeInTheDocument();
    });
  });

  it("renderiza pagina de progresso na rota /progresso/:studentId", async () => {
    renderWithRoute("/progresso/test-student-1");
    await waitFor(() => {
      // With no Supabase, shows empty state or progress title
      const el = screen.queryByText(/progresso na empresa/i) ||
        screen.queryByText(/sem dados/i) ||
        screen.queryByText(/a carregar/i) ||
        document.querySelector(".progress-page, .page-container, .loading-state");
      expect(el).not.toBeNull();
    });
  });

  it("redireciona /estatisticas para o painel", async () => {
    renderWithRoute("/estatisticas");
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: nameIncludes("centro operacional de estagios") })).toBeInTheDocument();
    });
  });

  it("renderiza configuracoes perfil na rota /config/perfil", async () => {
    renderWithRoute("/config/perfil");
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: nameIncludes("configuracoes") })).toBeInTheDocument();
      const settingsTabs = screen.getByRole("navigation", { name: nameIncludes("configuracoes") });
      expect(within(settingsTabs).getByRole("link", { name: nameIncludes("perfil") })).toHaveAttribute("aria-current", "page");
    });
  });

  it("renderiza configuracoes seguranca na rota /config/seguranca", async () => {
    renderWithRoute("/config/seguranca");
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: nameIncludes("seguranca e acesso") })).toBeInTheDocument();
    });
  });

  it("renderiza areas de formacao na rota /areas-formacao", async () => {
    renderWithRoute("/areas-formacao");
    await waitFor(() => {
      expect(screen.getAllByRole("heading", { name: nameIncludes("areas de formacao") }).length).toBeGreaterThan(0);
    });
  });

  it("renderiza centro documental na rota /documentos", async () => {
    renderWithRoute("/documentos");
    await waitFor(() => {
      expect(screen.getByRole("region", { name: /explorador documental/i })).toBeInTheDocument();
    });
  });

  it("renderiza ficha do estagiario na rota /aluno", async () => {
    renderWithRoute("/aluno");
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: nameIncludes("ficha do estagiario") })).toBeInTheDocument();
    });
  });

  it("renderiza configuracoes preferencias na rota /config/preferencias", async () => {
    renderWithRoute("/config/preferencias");
    await waitFor(() => {
      expect(screen.getAllByRole("heading", { name: nameIncludes("preferencias globais") }).length).toBeGreaterThan(0);
    });
  });

  it("renderiza configuracoes aparencia na rota /config/aparencia", async () => {
    renderWithRoute("/config/aparencia");
    await waitFor(() => {
      expect(screen.getAllByRole("heading", { name: nameIncludes("aparencia") }).length).toBeGreaterThan(0);
    });
  });

  it("renderiza perfil do aluno na rota /perfil/:studentId", async () => {
    renderWithRoute("/perfil/test-student-1");
    await waitFor(() => {
      const el = screen.queryByText(/a carregar/i) ||
        document.querySelector(".student-profile-page, .expanded-profile, .profile-loading");
      expect(el).not.toBeNull();
    });
  });
});
