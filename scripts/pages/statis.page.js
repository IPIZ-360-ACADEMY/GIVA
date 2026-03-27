(() => {
  const currentRoute = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  if (currentRoute !== "statis.html") return;

  const boot = () => {
    const uxDomain = window.GIVA?.domains?.ux || {};
    const showToast = uxDomain.showToast || ((message) => console.log(message));

    document.querySelectorAll(".stat-card").forEach((card) => {
      card.addEventListener("click", () => {
        const label = card.querySelector(".stat-head span")?.textContent?.trim() || "Indicador";
        const value = card.querySelector("h3")?.textContent?.trim() || "--";
        showToast(`${label}: ${value}`, "info", "insights");
      });
    });

    document.querySelectorAll(".list .list-item").forEach((item) => {
      item.addEventListener("click", () => {
        const text = item.querySelector("strong")?.textContent?.trim() || "Benchmark";
        showToast(`Benchmark selecionado: ${text}`, "info", "timeline");
      });
    });
  };

  if (window.GIVA?.domains?.ux) {
    boot();
  } else {
    window.addEventListener("giva:ready", boot, { once: true });
  }
})();
