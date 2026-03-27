(() => {
  const root = (window.GIVA = window.GIVA || {});
  root.domains = root.domains || {};

  root.domains.iam = {
    authKey: "ipiz-auth",
    users: {
      admin: {
        password: "Admin@2026",
        name: "Mandriz Admin",
        role: "Administrador"
      },
      coordenador: {
        password: "Coord@2026",
        name: "Edson Coordenador",
        role: "Coordenador"
      },
      operador: {
        password: "Oper@2026",
        name: "Operador GIVA",
        role: "Operador"
      }
    },
    rolePermissions: {
      Administrador: ["index.html", "est.html", "parc.html", "statis.html", "docs.html", "notif.html", "config.html", "alumno.html", "avaliacoes.html"],
      Coordenador: ["index.html", "est.html", "parc.html", "statis.html", "docs.html", "notif.html", "alumno.html", "avaliacoes.html"],
      Operador: ["index.html", "est.html", "docs.html", "notif.html", "alumno.html"]
    }
  };
})();
