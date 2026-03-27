(() => {
  const currentRoute = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  if (currentRoute !== "config.html") return;

  const boot = () => {
    const uxDomain = window.GIVA?.domains?.ux || {};
    const setButtonLoading = uxDomain.setButtonLoading || (() => {});
    const showToast = uxDomain.showToast || ((message) => console.log(message));
    const showModal = uxDomain.showModal || ((title, message) => alert(`${title}: ${message}`));

    const form = document.getElementById("settings-form");
    const toast = document.getElementById("save-feedback");
    if (form && toast) {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const submitBtn = form.querySelector("button[type='submit']");
        setButtonLoading(submitBtn, true, "A guardar...");
        toast.textContent = "Configuracoes salvas com sucesso.";
        toast.classList.remove("is-hidden");
        setTimeout(() => {
          toast.classList.add("is-hidden");
          setButtonLoading(submitBtn, false);
          showToast("Perfil atualizado.", "success", "task_alt");
        }, 900);
      });
    }

    form?.querySelector("button.btn.ghost[type='button']")?.addEventListener("click", () => {
      form.reset();
      showToast("Edicao cancelada", "info", "undo");
    });

    document.querySelectorAll("button.btn[type='button']").forEach((button) => {
      if (button.hasAttribute("data-download-doc")) return;
      const label = (button.textContent || "").trim().toLowerCase();
      if (label.includes("atualizar seguranca")) {
        button.addEventListener("click", () => {
          showModal(
            "Configuracoes de seguranca",
            "As alteracoes serao aplicadas assim que a API de identidade for integrada.",
            "warn",
            "admin_panel_settings"
          );
        });
      }
      if (label.includes("gerir acessos")) {
        button.addEventListener("click", () => {
          showModal(
            "Gestao de acessos",
            "O controlo granular de permissoes sera ativado na camada de backend enterprise.",
            "info",
            "manage_accounts"
          );
        });
      }
    });
  };

  if (window.GIVA?.domains?.ux) {
    boot();
  } else {
    window.addEventListener("giva:ready", boot, { once: true });
  }
})();
