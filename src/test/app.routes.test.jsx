import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../App.jsx";

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

  it("renderiza dashboard na rota raiz", () => {
    renderWithRoute("/");
    expect(screen.getByRole("heading", { name: /centro operacional de estagios/i })).toBeInTheDocument();
  });

  it("renderiza menu traduzido em pt-PT", () => {
    renderWithRoute("/", { language: "pt-PT", uiNotifications: true, density: "comfortable" });
    expect(screen.getByRole("link", { name: /painel/i })).toBeInTheDocument();
  });

  it("renderiza login em ingles quando idioma ativo e en", () => {
    renderWithRoute("/login", { language: "en", uiNotifications: true, density: "comfortable" });
    expect(screen.getByRole("heading", { name: /access giva/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("redireciona rota legada /docs para /documentos", async () => {
    renderWithRoute("/docs");
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /centro documental/i })).toBeInTheDocument();
    });
  });

  it("permite login e navega para dashboard", async () => {
    renderWithRoute("/login");

    fireEvent.change(screen.getByLabelText(/utilizador/i), { target: { value: "admin" } });
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: "Admin@2026" } });
    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /centro operacional de estagios/i })).toBeInTheDocument();
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
      expect(screen.getByRole("heading", { name: /operacao de estagios ativos/i })).toBeInTheDocument();
    });
  });

  it("redireciona rota legada /est para /estagios", async () => {
    renderWithRoute("/est");
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /operacao de estagios ativos/i })).toBeInTheDocument();
    });
  });

  it("renderiza turmas na rota /turmas", async () => {
    renderWithRoute("/turmas");
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /gestor de turmas/i })).toBeInTheDocument();
    });
  });

  it("abre detalhe da turma ao clicar no card", async () => {
    renderWithRoute("/turmas");

    const classCard = await screen.findByRole("link", { name: /abrir detalhes da turma: 11-ti-a/i });
    fireEvent.click(classCard);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /detalhes da turma/i })).toBeInTheDocument();
    });

    expect(screen.getByText(/ana melo/i)).toBeInTheDocument();
    expect(screen.getByText(/novasoft/i)).toBeInTheDocument();
  });

  it("renderiza parceiros na rota /parceiros", async () => {
    renderWithRoute("/parceiros");
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /ecossistema de parceiros/i })).toBeInTheDocument();
    });
  });

  it("redireciona rota legada /parc para /parceiros", async () => {
    renderWithRoute("/parc");
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /ecossistema de parceiros/i })).toBeInTheDocument();
    });
  });

  it("renderiza avaliacoes na rota /avaliacoes", async () => {
    renderWithRoute("/avaliacoes");
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /painel de avaliacoes/i })).toBeInTheDocument();
    });
  });

  it("renderiza notificacoes na rota /notificacoes", async () => {
    renderWithRoute("/notificacoes");
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /central de notificacoes/i })).toBeInTheDocument();
    });
  });

  it("redireciona rota legada /notif para /notificacoes", async () => {
    renderWithRoute("/notif");
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /central de notificacoes/i })).toBeInTheDocument();
    });
  });

  it("nav em ingles inclui link Evaluations", () => {
    renderWithRoute("/", { language: "en", uiNotifications: true, density: "comfortable" });
    expect(screen.getByRole("link", { name: /evaluations/i })).toBeInTheDocument();
  });

  it("nav em ingles inclui link Classes", () => {
    renderWithRoute("/", { language: "en", uiNotifications: true, density: "comfortable" });
    const mainMenu = screen.getByRole("navigation", { name: /main menu/i });
    const classesLink = within(mainMenu).getByRole("link", { name: /classes/i });
    expect(classesLink).toBeInTheDocument();
    expect(classesLink).toHaveAttribute("href", "/turmas");
  });
});
