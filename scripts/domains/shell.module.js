(() => {
  const root = (window.GIVA = window.GIVA || {});
  root.domains = root.domains || {};

  const applyTheme = ({ html, themeBtn, theme }) => {
    if (!(html instanceof HTMLElement)) return;
    html.setAttribute("data-theme", theme);
    localStorage.setItem("ipiz-theme", theme);
    if (themeBtn) {
      themeBtn.setAttribute("aria-label", theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro");
      const icon = themeBtn.querySelector("span");
      if (icon) {
        icon.textContent = theme === "dark" ? "light_mode" : "dark_mode";
      }
    }
  };

  const openSidebar = ({ sidebar, backdrop }) => {
    if (!sidebar || !backdrop) return;
    sidebar.classList.add("open");
    backdrop.classList.add("show");
  };

  const closeSidebar = ({ sidebar, backdrop }) => {
    if (!sidebar || !backdrop) return;
    sidebar.classList.remove("open");
    backdrop.classList.remove("show");
  };

  const setupSearch = ({ searchInput }) => {
    if (!searchInput) return;
    searchInput.addEventListener("input", () => {
      const query = searchInput.value.trim().toLowerCase();
      const items = document.querySelectorAll("[data-search]");
      items.forEach((item) => {
        const text = (item.getAttribute("data-search") || "").toLowerCase();
        item.style.display = query === "" || text.includes(query) ? "" : "none";
      });
    });
  };

  root.domains.shell = {
    applyTheme,
    openSidebar,
    closeSidebar,
    setupSearch,
  };
})();
