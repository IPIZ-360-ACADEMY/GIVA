(() => {
  const root = (window.GIVA = window.GIVA || {});
  root.domains = root.domains || {};

  const getSession = ({ authKey }) => {
    const raw = localStorage.getItem(authKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      localStorage.removeItem(authKey);
      return null;
    }
  };

  const setSession = ({ authKey, session }) => {
    localStorage.setItem(authKey, JSON.stringify(session));
  };

  const clearSession = ({ authKey }) => {
    localStorage.removeItem(authKey);
  };

  const canAccess = ({ rolePermissions, role, currentRoute }) => {
    const allowed = rolePermissions[role] || [];
    return allowed.includes(currentRoute);
  };

  const setupLogin = ({
    loginForm,
    loginUser,
    loginPassword,
    loginFeedback,
    users, 
    rolePermissions,
    authKey,
    setButtonLoading,
    redirect,
  }) => {
    if (!loginForm || !loginUser || !loginPassword || !loginFeedback) return;

    const existing = getSession({ authKey });
    if (existing && canAccess({ rolePermissions, role: existing.role, currentRoute: "index.html" })) {
      redirect("index.html");
      return;
    }

    loginForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const submitBtn = loginForm.querySelector("button[type='submit']");
      setButtonLoading(submitBtn, true, "A entrar...");
      const username = loginUser.value.trim().toLowerCase();
      const password = loginPassword.value;
      const user = users[username];

      if (!user || user.password !== password) {
        loginFeedback.textContent = "Credenciais invalidas. Tente novamente.";
        loginFeedback.classList.remove("is-hidden");
        setButtonLoading(submitBtn, false);
        return;
      }

      setSession({
        authKey,
        session: {
          username,
          name: user.name,
          role: user.role,
          loginAt: new Date().toISOString(),
        },
      });

      redirect("index.html");
    });
  };

  const enforceRouteProtection = ({ route, rolePermissions, authKey, redirect, setupLoginFn }) => {
    if (route === "login.html") {
      setupLoginFn();
      return null;
    }

    const session = getSession({ authKey });
    if (!session) {
      redirect("login.html");
      return null;
    }

    if (!canAccess({ rolePermissions, role: session.role, currentRoute: route })) {
      redirect("index.html");
      return null;
    }

    return session;
  };

  const applyUserContext = ({ session, rolePermissions }) => {
    if (!session) return;

    document.querySelectorAll(".profile-chip strong").forEach((node) => {
      node.textContent = session.name;
    });

    document.querySelectorAll(".profile-chip small").forEach((node) => {
      node.textContent = session.role;
    });

    document.querySelectorAll(".nav-link[data-route]").forEach((link) => {
      const target = link.getAttribute("data-route");
      if (!target) return;

      if (!canAccess({ rolePermissions, role: session.role, currentRoute: target })) {
        link.classList.add("is-hidden");
      }
    });
  };

  const setupLogout = ({ authKey, redirect }) => {
    document.querySelectorAll(".logout-link").forEach((logoutLink) => {
      logoutLink.addEventListener("click", (event) => {
        event.preventDefault();
        clearSession({ authKey });
        redirect("login.html");
      });
    });
  };

  root.domains.authGuard = {
    getSession,
    setSession,
    clearSession,
    canAccess,
    setupLogin,
    enforceRouteProtection,
    applyUserContext,
    setupLogout,
  };
})();
