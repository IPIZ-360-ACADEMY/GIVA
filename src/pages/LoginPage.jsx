import { useNavigate } from "react-router-dom";
import { useMemo } from "react";
import logoImage from "../../images/logo.png";
import { createTranslator } from "../utils/i18n.js";

export default function LoginPage() {
  const navigate = useNavigate();
  const language = useMemo(() => {
    const raw = localStorage.getItem("giva.preferences");
    if (!raw) {
      return "pt-BR";
    }
    try {
      const parsed = JSON.parse(raw);
      return parsed.language === "pt-PT" || parsed.language === "en" ? parsed.language : "pt-BR";
    } catch {
      return "pt-BR";
    }
  }, []);
  const t = useMemo(() => createTranslator(language), [language]);

  function handleSubmit(event) {
    event.preventDefault();
    navigate("/");
  }

  return (
    <main className="login-shell">
      <div className="login-box">
        <div className="login-box-logo">
          <img className="login-box-img" src={logoImage} alt="" />
        </div>

        <div className="login-box-head">
          <h1>{t("login.title")}</h1>
          <p>{t("login.brand")}</p>
        </div>

        <form className="login-box-form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="l-user">{t("login.username")}</label>
            <input id="l-user" type="text" required placeholder={t("login.usernamePlaceholder")} />
          </div>
          <div className="form-field">
            <label htmlFor="l-pass">{t("login.password")}</label>
            <input id="l-pass" type="password" required placeholder={t("login.passwordPlaceholder")} />
          </div>
          <button className="btn primary" type="submit">
            {t("login.submit")}
          </button>
        </form>

        <button className="btn ghost login-box-demo" type="button" onClick={() => navigate("/")}>
          {t("login.demo")}
        </button>

        <p className="login-box-footer">{t("login.badge")}</p>
      </div>
    </main>
  );
}
