import { useOutletContext } from "react-router-dom";
import { useState } from "react";

export default function SettingsPage() {
  const { showToast } = useOutletContext();
  const [form, setForm] = useState({
    nome: "Coordenacao IPIZ",
    email: "coordenacao@giva.ipiz.ao",
    telefone: "+244 923 000 000",
    twoFactor: "Ativada"
  });

  function submitSettings(event) {
    event.preventDefault();
    localStorage.setItem("giva.settings", JSON.stringify(form));
    showToast("Configuracoes guardadas com sucesso.");
  }

  return (
    <main className="page">
      <section className="page-header">
        <h2>Perfil e configuracoes</h2>
        <p>Controla identidade institucional, acessos e seguranca da plataforma.</p>
      </section>

      <section className="form-card">
        <h3>Perfil institucional</h3>
        <form onSubmit={submitSettings}>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="cfg-name">Nome exibido</label>
              <input id="cfg-name" value={form.nome} onChange={(event) => setForm((f) => ({ ...f, nome: event.target.value }))} />
            </div>
            <div className="form-field">
              <label htmlFor="cfg-email">Email</label>
              <input id="cfg-email" type="email" value={form.email} onChange={(event) => setForm((f) => ({ ...f, email: event.target.value }))} />
            </div>
            <div className="form-field">
              <label htmlFor="cfg-phone">Telefone</label>
              <input id="cfg-phone" value={form.telefone} onChange={(event) => setForm((f) => ({ ...f, telefone: event.target.value }))} />
            </div>
            <div className="form-field">
              <label htmlFor="cfg-2fa">2FA</label>
              <select id="cfg-2fa" value={form.twoFactor} onChange={(event) => setForm((f) => ({ ...f, twoFactor: event.target.value }))}>
                <option>Ativada</option>
                <option>Desativada</option>
              </select>
            </div>
          </div>

          <div className="form-actions">
            <button className="btn primary" type="submit">
              Guardar configuracoes
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
