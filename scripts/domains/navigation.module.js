(() => {
  const root = (window.GIVA = window.GIVA || {});
  root.domains = root.domains || {};

  const setActiveNav = ({ route }) => {
    document.querySelectorAll(".nav-link[data-route]").forEach((link) => {
      if (link.getAttribute("data-route") === route) {
        link.classList.add("active");
      } else {
        link.classList.remove("active");
      }
    });
  };

  root.domains.navigation = {
    setActiveNav,
  };
})();
