(() => {
  const root = (window.GIVA = window.GIVA || {});
  root.domains = root.domains || {};

  const init = ({ route, showToast } = {}) => {
    if (route === "login.html") return;

    document.querySelectorAll("a[href='#']:not(.logout-link)").forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        if (typeof showToast === "function") {
          showToast("Funcionalidade em preparacao.", "info", "construction");
        }
      });
    });
  };

  root.domains.uxFeedback = {
    init,
  };
})();
