import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../App.jsx";

function renderWithRoute(route) {
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
  it("renderiza dashboard na rota raiz", () => {
    renderWithRoute("/");
    expect(screen.getByRole("heading", { name: /centro operacional de estagios/i })).toBeInTheDocument();
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
});
