import { useNavigate } from "react-router-dom";
import logoImage from "../../images/logo.png";

export default function LoginPage() {
  const navigate = useNavigate();

  function handleSubmit(event) {
    event.preventDefault();
    navigate("/");
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <article className="login-highlight">
          <div className="login-brand-block">
            <img className="login-brand-logo" src={logoImage} alt="Logotipo GIVA IPIZ" />
            <div>
              <strong>GIVA IPIZ</strong>
              <small>Plataforma institucional IPIZ</small>
            </div>
          </div>
          <span className="tag login-tag">
            <span className="material-icons-sharp">workspace_premium</span>
            Experiencia oficial da academia
          </span>
          <h2>Gestao inteligente de estagios com visao completa e operacao em tempo real.</h2>
          <p>Coordena alunos, parceiros, documentos e desempenho num fluxo unificado, seguro e responsivo.</p>
        </article>

        <article className="login-panel">
          <h1>Aceder ao GIVA</h1>
          <p className="meta">Use as credenciais institucionais para entrar.</p>
          <form onSubmit={handleSubmit}>
            <div className="form-field">
              <label htmlFor="l-user">Utilizador</label>
              <input id="l-user" required placeholder="nome.apelido" />
            </div>
            <div className="form-field">
              <label htmlFor="l-pass">Senha</label>
              <input id="l-pass" type="password" required placeholder="********" />
            </div>
            <div className="form-actions">
              <button className="btn primary" type="submit">
                Entrar
              </button>
              <button className="btn ghost" type="button" onClick={() => navigate("/")}>Modo demonstracao</button>
            </div>
          </form>
        </article>
      </section>
    </main>
  );
}
