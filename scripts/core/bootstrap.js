(() => {
  const root = (window.GIVA = window.GIVA || {});

  async function start() {
    const modules = [
      "scripts/domains/ux.module.js",
      "scripts/domains/shell.module.js",
      "scripts/domains/navigation.module.js",
      "scripts/domains/iam.module.js",
      "scripts/domains/auth-guard.module.js",
      "scripts/domains/internship.module.js",
      "scripts/domains/document.module.js",
      "scripts/domains/ux-feedback.module.js",
      "scripts/legacy/app.legacy.js",
      "scripts/pages/parc.page.js",
      "scripts/pages/notif.page.js",
      "scripts/pages/statis.page.js",
      "scripts/pages/config.page.js"
    ];
    for (const src of modules) {
      await root.loadScript(src);
    }
    window.dispatchEvent(new Event("giva:ready"));
  }

  root.bootstrap = { start };
})();
