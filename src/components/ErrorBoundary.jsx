import { Component } from "react";
import logoImage from "../../images/logo.png";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
    this.onWindowError = this.onWindowError.bind(this);
    this.onUnhandledRejection = this.onUnhandledRejection.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidMount() {
    window.addEventListener("error", this.onWindowError);
    window.addEventListener("unhandledrejection", this.onUnhandledRejection);
  }

  componentWillUnmount() {
    window.removeEventListener("error", this.onWindowError);
    window.removeEventListener("unhandledrejection", this.onUnhandledRejection);
  }

  componentDidCatch(error, info) {
    console.error("[GIVA ErrorBoundary]", error, info.componentStack);
  }

  onWindowError(event) {
    if (this.state.hasError) return;
    const error = event?.error ?? new Error(event?.message ?? "Erro inesperado na aplicação.");
    this.setState({ hasError: true, error });
  }

  onUnhandledRejection(event) {
    if (this.state.hasError) return;
    const reason = event?.reason;
    const error = reason instanceof Error
      ? reason
      : new Error(typeof reason === "string" ? reason : "Falha inesperada ao carregar recursos do sistema.");
    this.setState({ hasError: true, error });
  }

  getFriendlyMessage() {
    const message = String(this.state.error?.message ?? "").toLowerCase();
    const isBundleError =
      message.includes("chunk")
      || message.includes("dynamically imported module")
      || message.includes("failed to fetch")
      || message.includes("loading css chunk")
      || message.includes("loading chunk")
      || message.includes("importing a module script failed");

    if (isBundleError) {
      return {
        title: "Estamos a atualizar o sistema agora",
        description:
          "A versão da aplicação mudou durante a sua navegação. Para sua segurança, recarregue a página para continuar com os dados mais recentes.",
      };
    }

    return {
      title: "Encontrámos um problema inesperado",
      description:
        "A sua sessão está protegida. Recarregue a página para retomar normalmente. Se o problema persistir, contacte o suporte institucional.",
    };
  }

  render() {
    if (this.state.hasError) {
      const friendly = this.getFriendlyMessage();
      return (
        <main className="giva-error-screen" role="alert" aria-live="assertive">
          <div className="giva-error-card">
            <img className="giva-error-logo" src={logoImage} alt="Logo GIVA" />

            <p className="giva-error-kicker">GIVA | Plataforma Institucional</p>
            <h1 className="giva-error-title">{friendly.title}</h1>
            <p className="giva-error-description">{friendly.description}</p>

            <div className="giva-error-actions">
              <button className="btn primary" onClick={() => window.location.reload()}>
                Recarregar sistema
              </button>
              <button className="btn secondary" onClick={() => { window.location.href = "/"; }}>
                Ir para o início
              </button>
            </div>

            <p className="giva-error-helper">
              Caso continue a ver esta mensagem, aguarde alguns segundos e tente novamente.
            </p>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
