(() => {
  const currentRoute = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  if (currentRoute !== "parc.html") return;

  const boot = () => {
    const uxDomain = window.GIVA?.domains?.ux || {};
    const showModal = uxDomain.showModal || ((title, message) => alert(`${title}: ${message}`));

    document.querySelectorAll(".partner-card .btn[type='button']").forEach((button) => {
      if (button.hasAttribute("data-download-doc")) return;
      const label = (button.textContent || "").trim().toLowerCase();

      if (label.includes("pipeline")) {
        button.addEventListener("click", () => {
          showModal(
            "Pipeline carregado",
            "Detalhes operacionais do parceiro estao a ser preparados para a proxima versao.",
            "success",
            "hub"
          );
        });
      }

      if (label.includes("contato")) {
        button.addEventListener("click", () => {
          showModal(
            "Contato do parceiro",
            "A janela de contacto sera integrada com email e WhatsApp empresarial.",
            "info",
            "call"
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
