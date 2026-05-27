import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[GIVA ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          fontFamily: "system-ui, sans-serif",
        }}>
          <div style={{
            maxWidth: 480,
            textAlign: "center",
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 16,
            padding: "2.5rem 2rem",
            boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
          }}>
            <span style={{ fontSize: "2.5rem", display: "block", marginBottom: "1rem" }}>⚠️</span>
            <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.1rem", color: "#0f1f2d" }}>
              Ocorreu um erro inesperado
            </h2>
            <p style={{ color: "#5f7386", fontSize: "0.875rem", margin: "0 0 1.5rem" }}>
              {this.state.error?.message ?? "Algo correu mal ao carregar a página."}
            </p>
            <button
              style={{
                background: "#0f6d67",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "0.6rem 1.4rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
              onClick={() => window.location.reload()}
            >
              Recarregar página
            </button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
