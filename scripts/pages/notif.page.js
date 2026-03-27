(() => {
  const currentRoute = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  if (currentRoute !== "notif.html") return;

  const boot = () => {
    const uxDomain = window.GIVA?.domains?.ux || {};
    const setButtonLoading = uxDomain.setButtonLoading || (() => {});
    const showToast = uxDomain.showToast || ((message) => console.log(message));

    const noticeList = document.getElementById("notice-list");
    const markAllBtn = document.getElementById("mark-all-read");
    if (!noticeList || !markAllBtn) return;

    markAllBtn.addEventListener("click", () => {
      setButtonLoading(markAllBtn, true, "A atualizar...");
      noticeList.querySelectorAll(".notice").forEach((notice) => {
        notice.classList.add("is-read");
      });
      setTimeout(() => {
        setButtonLoading(markAllBtn, false);
        showToast("Todas as notificacoes foram marcadas como lidas.", "success", "done_all");
      }, 350);
    });

    noticeList.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const button = target.closest("button[data-action='read']");
      if (!button) return;

      const notice = button.closest(".notice");
      if (!notice) return;

      setButtonLoading(button, true, "A atualizar...");
      setTimeout(() => {
        notice.classList.toggle("is-read");
        setButtonLoading(button, false);
        showToast("Estado da notificacao atualizado.", "success", "task_alt");
      }, 250);
    });
  };

  if (window.GIVA?.domains?.ux) {
    boot();
  } else {
    window.addEventListener("giva:ready", boot, { once: true });
  }
})();
