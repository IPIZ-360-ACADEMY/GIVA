(() => {
  const root = (window.GIVA = window.GIVA || {});

  root.loadScript = function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-src="${src}"]`);
      if (existing) {
        if (existing.dataset.loaded === "true") {
          resolve();
          return;
        }
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error(`Falha ao carregar ${src}`)), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = src;
      script.async = false;
      script.dataset.src = src;
      script.onload = () => {
        script.dataset.loaded = "true";
        resolve();
      };
      script.onerror = () => reject(new Error(`Falha ao carregar ${src}`));
      document.head.appendChild(script);
    });
  };

  root.loadScript("scripts/core/bootstrap.js")
    .then(() => root.bootstrap.start())
    .catch((error) => {
      console.error("Bootstrap modular falhou, fallback legado direto:", error);
      return root.loadScript("scripts/domains/shell.module.js")
        .then(() => root.loadScript("scripts/domains/navigation.module.js"))
        .then(() => root.loadScript("scripts/domains/iam.module.js"))
        .then(() => root.loadScript("scripts/domains/auth-guard.module.js"))
        .then(() => root.loadScript("scripts/domains/internship.module.js"))
        .then(() => root.loadScript("scripts/domains/document.module.js"))
        .then(() => root.loadScript("scripts/domains/ux-feedback.module.js"))
        .then(() => root.loadScript("scripts/legacy/app.legacy.js"))
        .then(() => root.loadScript("scripts/pages/parc.page.js"))
        .then(() => root.loadScript("scripts/pages/notif.page.js"))
        .then(() => root.loadScript("scripts/pages/statis.page.js"))
        .then(() => root.loadScript("scripts/pages/config.page.js"))
        .then(() => {
          window.dispatchEvent(new Event("giva:ready"));
        });
    })
    .catch((legacyError) => {
      console.error("Falha total ao inicializar a aplicacao:", legacyError);
    });
})();
