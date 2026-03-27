(() => {
  const root = (window.GIVA = window.GIVA || {});
  root.domains = root.domains || {};

  const pulseEntry = (element) => {
    if (!element) return;
    element.classList.remove("ux-enter");
    void element.offsetWidth;
    element.classList.add("ux-enter");
  };

  const setButtonLoading = (button, isLoading, label) => {
    if (!(button instanceof HTMLButtonElement)) return;
    if (isLoading) {
      if (!button.dataset.originalLabel) {
        button.dataset.originalLabel = (button.textContent || "").trim();
      }
      button.disabled = true;
      button.classList.add("is-loading");
      button.textContent = label || "A processar...";
      return;
    }
    button.disabled = false;
    button.classList.remove("is-loading");
    if (button.dataset.originalLabel) {
      button.textContent = button.dataset.originalLabel;
    }
  };

  const createUxModal = () => {
    const existing = document.getElementById("ux-modal");
    if (existing) return existing;

    const modal = document.createElement("div");
    modal.id = "ux-modal";
    modal.className = "ux-modal is-hidden";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "ux-modal-title");
    modal.innerHTML = `
<div class="ux-modal-backdrop" data-close="ux-modal"></div>
<div class="ux-modal-card">
  <div class="ux-modal-head">
    <span class="material-icons-sharp ux-modal-icon" id="ux-modal-icon">info</span>
    <h3 id="ux-modal-title">Acao iniciada</h3>
  </div>
  <p id="ux-modal-message">Estamos a processar a sua solicitacao.</p>
  <div class="ux-modal-actions">
    <button class="btn primary" type="button" id="ux-modal-confirm">Continuar</button>
    <button class="btn ghost" type="button" data-close="ux-modal">Fechar</button>
  </div>
</div>
`;
    document.body.appendChild(modal);

    modal.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.matches("[data-close='ux-modal']")) {
        modal.classList.add("is-hidden");
      }
    });

    const confirmBtn = modal.querySelector("#ux-modal-confirm");
    if (confirmBtn) {
      confirmBtn.addEventListener("click", () => {
        modal.classList.add("is-hidden");
      });
    }

    return modal;
  };

  const createUxToast = () => {
    const existing = document.getElementById("ux-toast");
    if (existing) return existing;

    const toast = document.createElement("div");
    toast.id = "ux-toast";
    toast.className = "ux-toast is-hidden";
    toast.innerHTML = `
<span class="material-icons-sharp ux-toast-icon" id="ux-toast-icon">info</span>
<span id="ux-toast-message"></span>
`;
    document.body.appendChild(toast);
    return toast;
  };

  const setUxLevel = (target, level) => {
    if (!target) return;
    target.classList.remove("ux-level-info", "ux-level-success", "ux-level-warn", "ux-level-danger");
    target.classList.add(`ux-level-${level}`);
  };

  const showToast = (message, level = "info", icon = "info") => {
    const toast = createUxToast();
    const messageNode = toast.querySelector("#ux-toast-message");
    const iconNode = toast.querySelector("#ux-toast-icon");
    if (messageNode) messageNode.textContent = message;
    if (iconNode) iconNode.textContent = icon;
    setUxLevel(toast, level);
    toast.classList.remove("is-hidden");
    pulseEntry(toast);
    setTimeout(() => toast.classList.add("is-hidden"), 2000);
  };

  const showModal = (title, message, level = "info", icon = "info") => {
    const modal = createUxModal();
    const titleNode = modal.querySelector("#ux-modal-title");
    const messageNode = modal.querySelector("#ux-modal-message");
    const iconNode = modal.querySelector("#ux-modal-icon");
    if (titleNode) titleNode.textContent = title;
    if (messageNode) messageNode.textContent = message;
    if (iconNode) iconNode.textContent = icon;
    setUxLevel(modal.querySelector(".ux-modal-card"), level);
    modal.classList.remove("is-hidden");
    pulseEntry(modal.querySelector(".ux-modal-card"));
  };

  root.domains.ux = {
    pulseEntry,
    setButtonLoading,
    createUxModal,
    createUxToast,
    setUxLevel,
    showToast,
    showModal,
  };
})();
