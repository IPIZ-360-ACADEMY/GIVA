(() => {
const html = document.documentElement;
const sidebar = document.getElementById("sidebar");
const menuBtn = document.getElementById("menu-btn");
const closeBtn = document.getElementById("close-btn");
const backdrop = document.getElementById("backdrop");
const themeBtn = document.getElementById("theme-btn");
const searchInput = document.getElementById("global-search");
const loginForm = document.getElementById("login-form");
const loginUser = document.getElementById("login-user");
const loginPassword = document.getElementById("login-password");
const loginFeedback = document.getElementById("login-feedback");

const route = (location.pathname.split("/").pop() || "index.html").toLowerCase();
const authKey = "ipiz-auth";
const scriptLoadCache = new Map();
let logoDataUrlPromise = null;
const docRegistryKey = "ipiz-doc-registry";
const auditKeyPairStorageKey = "ipiz-audit-keypair-v1";

const users = {
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
};

const rolePermissions = {
Administrador: ["index.html", "est.html", "parc.html", "statis.html", "docs.html", "notif.html", "config.html", "alumno.html", "avaliacoes.html"],
Coordenador: ["index.html", "est.html", "parc.html", "statis.html", "docs.html", "notif.html", "alumno.html", "avaliacoes.html"],
Operador: ["index.html", "est.html", "docs.html", "notif.html", "alumno.html"]
};

// ========== SISTEMA DE ACOMPANHAMENTO DE ESTÁGIO ==========
const stageSystem = (() => {
  const stageKey = "ipiz-stages";
  
  // Dados padrão de estrutura do sistema de estágio
  const defaultStages = {
    courses: [
      { id: "ti", name: "Tecnologia da Informacao", short: "TI", color: "#0a6c85" },
      { id: "eie", name: "Engenharia Industrial e Electronica", short: "EIE", color: "#1e90ff" },
      { id: "tlqb", name: "Tecnico de Laboratorio de Qualidade", short: "TLQB", color: "#0f8f57" },
      { id: "mecanica", name: "Mecanica", short: "Mecanica", color: "#b26b00" }
    ],
    classes: [
      { id: "ti-a", courseId: "ti", year: 3, section: "A", supervisor: "Eng. Castro" },
      { id: "ti-b", courseId: "ti", year: 3, section: "B", supervisor: "Eng. Paulino" },
      { id: "eie-a", courseId: "eie", year: 3, section: "A", supervisor: "Eng. Zé" },
      { id: "eie-b", courseId: "eie", year: 3, section: "B", supervisor: "Eng. Silva" },
      { id: "tlqb-a", courseId: "tlqb", year: 3, section: "A", supervisor: "Dr. Carvalho" },
      { id: "mecanica-a", courseId: "mecanica", year: 3, section: "A", supervisor: "Eng. Neves" }
    ],
    companies: [
      { id: "tecangola", name: "TecAngola", sector: "Tecnologia", areas: ["Desenvolvimento", "Infraestrutura", "Seguranca"] },
      { id: "naio", name: "NAIO", sector: "Consultoria", areas: ["Gestao", "RH", "Operacional"] },
      { id: "nexcore", name: "Nexcore", sector: "Telecomunicacoes", areas: ["Rede", "Suporte", "Projetos"] },
      { id: "impacta", name: "Impacta Lab", sector: "Laboratorio", areas: ["Analise", "Qualidade", "Inovacao"] },
      { id: "sinerpro", name: "SinerPro", sector: "Energia", areas: ["Manutencao", "Supervisao", "Seguranca"] }
    ],
    stagePhases: [
      { id: "initial", name: "Triagem Inicial", order: 1, icon: "assignment" },
      { id: "interview", name: "Entrevista Tecnica", order: 2, icon: "assignment_turned_in" },
      { id: "onboarding", name: "Onboarding Parceiro", order: 3, icon: "how_to_reg" },
      { id: "active", name: "Estagio Ativo", order: 4, icon: "work" },
      { id: "evaluation", name: "Avaliacao Final", order: 5, icon: "assessment" },
      { id: "completed", name: "Concluido", order: 6, icon: "check_circle" }
    ],
    stageStatus: [
      { id: "pending", name: "Pendente", color: "#d0d5dd" },
      { id: "approved", name: "Aprovado", color: "#0f8f57" },
      { id: "inprogress", name: "Em Progresso", color: "#0a6c85" },
      { id: "paused", name: "Suspenso", color: "#b26b00" },
      { id: "completed", name: "Concluido", color: "#667085" },
      { id: "rejected", name: "Rejeitado", color: "#c23854" }
    ],
    knowledge: [
      "Programacao", "Gestao de Projectos", "Seguranca Informatica",
      "Analise de Dados", "Atendimento", "Lideranca",
      "Comunicacao", "Resolucao de Problemas", "Trabalho em Equipa",
      "Qualidade", "Infraestrutura", "Suporte Tecnico",
      "Manutencao", "Electrical Work", "Design", "Development"
    ],
    tutors: [
      { id: "t1", name: "Eng. Carlos Neves", email: "carlos.neves@example.com", expertise: ["TI", "Seguranca"] },
      { id: "t2", name: "Dr. Maria Santos", email: "maria.santos@example.com", expertise: ["EIE", "Projetos"] },
      { id: "t3", name: "Eng. Joao Pereira", email: "joao.pereira@example.com", expertise: ["Qualidade", "Laboratorio"] },
      { id: "t4", name: "Msc. Ana Dias", email: "ana.dias@example.com", expertise: ["Gestao", "RH"] }
    ]
  };

  // Dados de alunos com estágios
  const defaultStudents = [
    {
      id: "alu-001",
      name: "Ana Domingo",
      email: "ana.domingo@ipiz.ao",
      phone: "+244 923 456 789",
      classId: "ti-a",
      courseId: "ti",
      matricula: "2023-TI-001",
      stage: {
        id: "est-001",
        companyId: "tecangola",
        areaId: 0,
        phaseId: "initial",
        statusId: "pending",
        startDate: new Date(2026, 2, 15),
        expectedEndDate: new Date(2026, 8, 15),
        knowledgeFocus: ["Programacao", "Seguranca Informatica"],
        tutorId: "t1",
        supervisor: "Eng. Castro"
      },
      performance: { attendance: 95, engagement: 4.5, compliance: 4.8 },
      evaluations: []
    },
    {
      id: "alu-002",
      name: "Rui Nicolau",
      email: "rui.nicolau@ipiz.ao",
      phone: "+244 923 456 790",
      classId: "eie-a",
      courseId: "eie",
      matricula: "2023-EIE-001",
      stage: {
        id: "est-002",
        companyId: "naio",
        areaId: 1,
        phaseId: "interview",
        statusId: "inprogress",
        startDate: new Date(2026, 1, 20),
        expectedEndDate: new Date(2026, 7, 20),
        knowledgeFocus: ["Gestao de Projectos", "Lideranca"],
        tutorId: "t2",
        supervisor: "Eng. Zé"
      },
      performance: { attendance: 89, engagement: 4.2, compliance: 4.5 },
      evaluations: []
    },
    {
      id: "alu-003",
      name: "Joao Gilberto",
      email: "joao.gilberto@ipiz.ao",
      phone: "+244 923 456 791",
      classId: "tlqb-a",
      courseId: "tlqb",
      matricula: "2023-TLQB-001",
      stage: {
        id: "est-003",
        companyId: "impacta",
        areaId: 1,
        phaseId: "onboarding",
        statusId: "approved",
        startDate: new Date(2026, 2, 1),
        expectedEndDate: new Date(2026, 8, 1),
        knowledgeFocus: ["Qualidade", "Analise de Dados"],
        tutorId: "t3",
        supervisor: "Dr. Carvalho"
      },
      performance: { attendance: 100, engagement: 5.0, compliance: 5.0 },
      evaluations: []
    },
    {
      id: "alu-004",
      name: "Marta Josefa",
      email: "marta.josefa@ipiz.ao",
      phone: "+244 923 456 792",
      classId: "ti-a",
      courseId: "ti",
      matricula: "2023-TI-002",
      stage: {
        id: "est-004",
        companyId: "tecangola",
        areaId: 0,
        phaseId: "active",
        statusId: "inprogress",
        startDate: new Date(2025, 9, 15),
        expectedEndDate: new Date(2026, 3, 15),
        knowledgeFocus: ["Programacao", "Development"],
        tutorId: "t1",
        supervisor: "Eng. Castro"
      },
      performance: { attendance: 98, engagement: 4.7, compliance: 4.9 },
      evaluations: []
    },
    {
      id: "alu-005",
      name: "Sandra Gomes",
      email: "sandra.gomes@ipiz.ao",
      phone: "+244 923 456 793",
      classId: "eie-b",
      courseId: "eie",
      matricula: "2023-EIE-002",
      stage: {
        id: "est-005",
        companyId: "nexcore",
        areaId: 0,
        phaseId: "active",
        statusId: "inprogress",
        startDate: new Date(2025, 8, 29),
        expectedEndDate: new Date(2026, 2, 29),
        knowledgeFocus: ["Infraestrutura", "Suporte Tecnico"],
        tutorId: "t2",
        supervisor: "Eng. Silva"
      },
      performance: { attendance: 94, engagement: 4.4, compliance: 4.6 },
      evaluations: []
    },
    {
      id: "alu-006",
      name: "Israel Mendes",
      email: "israel.mendes@ipiz.ao",
      phone: "+244 923 456 794",
      classId: "mecanica-a",
      courseId: "mecanica",
      matricula: "2023-MECANICA-001",
      stage: {
        id: "est-006",
        companyId: "impacta",
        areaId: 2,
        phaseId: "active",
        statusId: "inprogress",
        startDate: new Date(2025, 10, 15),
        expectedEndDate: new Date(2026, 4, 15),
        knowledgeFocus: ["Manutencao", "Seguranca"],
        tutorId: "t3",
        supervisor: "Eng. Neves"
      },
      performance: { attendance: 96, engagement: 4.6, compliance: 4.7 },
      evaluations: []
    },
    {
      id: "alu-007",
      name: "Elisa Costa",
      email: "elisa.costa@ipiz.ao",
      phone: "+244 923 456 795",
      classId: "ti-b",
      courseId: "ti",
      matricula: "2023-TI-003",
      stage: {
        id: "est-007",
        companyId: "nexcore",
        areaId: 1,
        phaseId: "active",
        statusId: "inprogress",
        startDate: new Date(2025, 10, 1),
        expectedEndDate: new Date(2026, 4, 1),
        knowledgeFocus: ["Suporte Tecnico", "Atendimento"],
        tutorId: "t1",
        supervisor: "Eng. Paulino"
      },
      performance: { attendance: 91, engagement: 4.1, compliance: 4.3 },
      evaluations: []
    },
    {
      id: "alu-008",
      name: "Jose Pinto",
      email: "jose.pinto@ipiz.ao",
      phone: "+244 923 456 796",
      classId: "ti-b",
      courseId: "ti",
      matricula: "2023-TI-004",
      stage: {
        id: "est-008",
        companyId: "sinerpro",
        areaId: 1,
        phaseId: "evaluation",
        statusId: "completed",
        startDate: new Date(2025, 6, 1),
        expectedEndDate: new Date(2025, 12, 1),
        knowledgeFocus: ["Manutencao", "Supervisao"],
        tutorId: "t1",
        supervisor: "Eng. Paulino"
      },
      performance: { attendance: 99, engagement: 4.9, compliance: 5.0 },
      evaluations: [
        { tutorId: "t1", date: new Date(2025, 11, 20), score: 4.8, feedback: "Excelente desempenho e dedicacao" },
        { companySupervisor: "Supervisor Empresa", date: new Date(2025, 11, 21), score: 4.7, feedback: "Muito bom trabalho em equipa" }
      ]
    },
    {
      id: "alu-009",
      name: "Aline de Jesus",
      email: "aline.jesus@ipiz.ao",
      phone: "+244 923 456 797",
      classId: "eie-a",
      courseId: "eie",
      matricula: "2023-EIE-003",
      stage: {
        id: "est-009",
        companyId: "tecangola",
        areaId: 2,
        phaseId: "active",
        statusId: "inprogress",
        startDate: new Date(2025, 11, 1),
        expectedEndDate: new Date(2026, 5, 1),
        knowledgeFocus: ["Desenvolvimento", "Design"],
        tutorId: "t2",
        supervisor: "Eng. Zé"
      },
      performance: { attendance: 97, engagement: 4.8, compliance: 4.9 },
      evaluations: []
    },
    {
      id: "alu-010",
      name: "Humberto Pires",
      email: "humberto.pires@ipiz.ao",
      phone: "+244 923 456 798",
      classId: "tlqb-a",
      courseId: "tlqb",
      matricula: "2023-TLQB-002",
      stage: {
        id: "est-010",
        companyId: "naio",
        areaId: 0,
        phaseId: "interview",
        statusId: "pending",
        startDate: new Date(2026, 2, 20),
        expectedEndDate: new Date(2026, 8, 20),
        knowledgeFocus: ["Analise de Dados", "Qualidade"],
        tutorId: "t3",
        supervisor: "Dr. Carvalho"
      },
      performance: { attendance: 85, engagement: 3.9, compliance: 4.0 },
      evaluations: []
    }
  ];

  const loadStages = () => {
    const raw = localStorage.getItem(stageKey);
    if (!raw) {
      const initial = { stages: defaultStudents, system: defaultStages };
      localStorage.setItem(stageKey, JSON.stringify(initial));
      return initial;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return { stages: defaultStudents, system: defaultStages };
    }
  };

  const saveStages = (data) => {
    localStorage.setItem(stageKey, JSON.stringify(data));
  };

  const getStudentById = (studentId) => {
    const data = loadStages();
    return data.stages.find(s => s.id === studentId) || null;
  };

  const getStudentsByClass = (classId) => {
    const data = loadStages();
    return data.stages.filter(s => s.classId === classId);
  };

  const getStudentsByCourse = (courseId) => {
    const data = loadStages();
    return data.stages.filter(s => s.courseId === courseId);
  };

  const getStudentsByCompany = (companyId) => {
    const data = loadStages();
    return data.stages.filter(s => s.stage.companyId === companyId);
  };

  const getStudentsByPhase = (phaseId) => {
    const data = loadStages();
    return data.stages.filter(s => s.stage.phaseId === phaseId);
  };

  const updateStudentStage = (studentId, stageUpdates) => {
    const data = loadStages();
    const student = data.stages.find(s => s.id === studentId);
    if (student) {
      Object.assign(student.stage, stageUpdates);
      saveStages(data);
      return student;
    }
    return null;
  };

  const addEvaluation = (studentId, evaluation) => {
    const data = loadStages();
    const student = data.stages.find(s => s.id === studentId);
    if (student) {
      student.evaluations.push({ ...evaluation, date: new Date() });
      saveStages(data);
      return student;
    }
    return null;
  };

  const getCourseById = (courseId) => {
    const data = loadStages();
    return data.system.courses.find(c => c.id === courseId);
  };

  const getCompanyById = (companyId) => {
    const data = loadStages();
    return data.system.companies.find(c => c.id === companyId);
  };

  const getPhaseById = (phaseId) => {
    const data = loadStages();
    return data.system.stagePhases.find(p => p.id === phaseId);
  };

  const getStatusById = (statusId) => {
    const data = loadStages();
    return data.system.stageStatus.find(s => s.id === statusId);
  };

  const getTutorById = (tutorId) => {
    const data = loadStages();
    return data.system.tutors.find(t => t.id === tutorId);
  };

  const getSystemData = () => {
    const data = loadStages();
    return data.system;
  };

  const getAllStudents = () => {
    const data = loadStages();
    return data.stages;
  };

  return {
    loadStages,
    saveStages,
    getStudentById,
    getStudentsByClass,
    getStudentsByCourse,
    getStudentsByCompany,
    getStudentsByPhase,
    updateStudentStage,
    addEvaluation,
    getCourseById,
    getCompanyById,
    getPhaseById,
    getStatusById,
    getTutorById,
    getSystemData,
    getAllStudents
  };
})();

const getSession = () => {
const raw = localStorage.getItem(authKey);
if (!raw) {
return null;
}

try {
return JSON.parse(raw);
} catch {
localStorage.removeItem(authKey);
return null;
}
};

const setSession = (session) => {
localStorage.setItem(authKey, JSON.stringify(session));
};

const clearSession = () => {
localStorage.removeItem(authKey);
};

const redirect = (target) => {
window.location.href = target;
};

const canAccess = (role, currentRoute) => {
const allowed = rolePermissions[role] || [];
return allowed.includes(currentRoute);
};

const setButtonLoading = (button, isLoading, label) => {
if (!(button instanceof HTMLButtonElement)) {
return;
}

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

const pulseEntry = (element) => {
if (!element) {
return;
}
element.classList.remove("ux-enter");
void element.offsetWidth;
element.classList.add("ux-enter");
};

const setupLogin = () => {
if (!loginForm || !loginUser || !loginPassword || !loginFeedback) {
return;
}

const existing = getSession();
if (existing && canAccess(existing.role, "index.html")) {
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
username,
name: user.name,
role: user.role,
loginAt: new Date().toISOString()
});

redirect("index.html");
});
};

const enforceRouteProtection = () => {
if (route === "login.html") {
setupLogin();
return null;
}

const session = getSession();
if (!session) {
redirect("login.html");
return null;
}

if (!canAccess(session.role, route)) {
redirect("index.html");
return null;
}

return session;
};

const applyUserContext = (session) => {
if (!session) {
return;
}

document.querySelectorAll(".profile-chip strong").forEach((node) => {
node.textContent = session.name;
});

document.querySelectorAll(".profile-chip small").forEach((node) => {
node.textContent = session.role;
});

document.querySelectorAll(".nav-link[data-route]").forEach((link) => {
const target = link.getAttribute("data-route");
if (!target) {
return;
}

if (!canAccess(session.role, target)) {
link.classList.add("is-hidden");
}
});
};

const setupLogout = () => {
document.querySelectorAll(".logout-link").forEach((logoutLink) => {
logoutLink.addEventListener("click", (event) => {
event.preventDefault();
clearSession();
redirect("login.html");
});
});
};

const setActiveNav = () => {
document.querySelectorAll(".nav-link[data-route]").forEach((link) => {
if (link.getAttribute("data-route") === route) {
link.classList.add("active");
} else {
link.classList.remove("active");
}
});
};

const applyTheme = (theme) => {
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

const openSidebar = () => {
if (!sidebar || !backdrop) {
return;
}
sidebar.classList.add("open");
backdrop.classList.add("show");
};

const closeSidebar = () => {
if (!sidebar || !backdrop) {
return;
}
sidebar.classList.remove("open");
backdrop.classList.remove("show");
};

const setupSearch = () => {
if (!searchInput) {
return;
}

searchInput.addEventListener("input", () => {
const query = searchInput.value.trim().toLowerCase();
const items = document.querySelectorAll("[data-search]");
items.forEach((item) => {
const text = (item.getAttribute("data-search") || "").toLowerCase();
item.style.display = query === "" || text.includes(query) ? "" : "none";
});
});
};

const setupNotifications = () => {
const noticeList = document.getElementById("notice-list");
const markAllBtn = document.getElementById("mark-all-read");

if (!noticeList || !markAllBtn) {
return;
}

markAllBtn.addEventListener("click", () => {
noticeList.querySelectorAll(".notice").forEach((notice) => {
notice.classList.add("is-read");
});
});

noticeList.addEventListener("click", (event) => {
const target = event.target;
if (!(target instanceof HTMLElement)) {
return;
}

const button = target.closest("button[data-action='read']");
if (!button) {
return;
}

const notice = button.closest(".notice");
if (notice) {
notice.classList.toggle("is-read");
}
});
};

const setupSettingsForm = () => {
const form = document.getElementById("settings-form");
const toast = document.getElementById("save-feedback");
if (!form || !toast) {
return;
}

form.addEventListener("submit", (event) => {
event.preventDefault();
const submitBtn = form.querySelector("button[type='submit']");
setButtonLoading(submitBtn, true, "A guardar...");
toast.textContent = "Configuracoes salvas com sucesso.";
toast.classList.remove("is-hidden");
setTimeout(() => {
toast.classList.add("is-hidden");
setButtonLoading(submitBtn, false);
}, 2200);
});
};

const createUxModal = () => {
const existing = document.getElementById("ux-modal");
if (existing) {
return existing;
}

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
if (!(target instanceof HTMLElement)) {
return;
}

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
if (existing) {
return existing;
}

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
if (!target) {
return;
}
target.classList.remove("ux-level-info", "ux-level-success", "ux-level-warn", "ux-level-danger");
target.classList.add(`ux-level-${level}`);
};

const showToast = (message, level = "info", icon = "info") => {
const toast = createUxToast();
const messageNode = toast.querySelector("#ux-toast-message");
const iconNode = toast.querySelector("#ux-toast-icon");
if (messageNode) {
messageNode.textContent = message;
}
if (iconNode) {
iconNode.textContent = icon;
}
setUxLevel(toast, level);
toast.classList.remove("is-hidden");
pulseEntry(toast);
setTimeout(() => {
toast.classList.add("is-hidden");
}, 2000);
};

const showModal = (title, message, level = "info", icon = "info") => {
const modal = createUxModal();
const titleNode = modal.querySelector("#ux-modal-title");
const messageNode = modal.querySelector("#ux-modal-message");
const iconNode = modal.querySelector("#ux-modal-icon");
if (titleNode) {
titleNode.textContent = title;
}
if (messageNode) {
messageNode.textContent = message;
}
if (iconNode) {
iconNode.textContent = icon;
}
setUxLevel(modal.querySelector(".ux-modal-card"), level);
modal.classList.remove("is-hidden");
pulseEntry(modal.querySelector(".ux-modal-card"));
};

const loadExternalScript = (url, readyCheck) => {
if (readyCheck()) {
return Promise.resolve();
}

if (scriptLoadCache.has(url)) {
return scriptLoadCache.get(url);
}

const promise = new Promise((resolve, reject) => {
const script = document.createElement("script");
script.src = url;
script.async = true;
script.onload = () => {
if (readyCheck()) {
resolve();
return;
}
reject(new Error("Biblioteca carregada sem API esperada"));
};
script.onerror = () => reject(new Error("Falha ao carregar biblioteca externa"));
document.head.appendChild(script);
});

scriptLoadCache.set(url, promise);
return promise;
};

const getLogoDataUrl = async () => {
if (logoDataUrlPromise) {
return logoDataUrlPromise;
}

logoDataUrlPromise = fetch(new URL("./images/logo.png", window.location.href).href)
.then((response) => {
if (!response.ok) {
throw new Error("Falha ao carregar logo");
}
return response.blob();
})
.then((blob) => new Promise((resolve, reject) => {
const reader = new FileReader();
reader.onloadend = () => resolve(String(reader.result));
reader.onerror = reject;
reader.readAsDataURL(blob);
}))
.catch(() => "");

return logoDataUrlPromise;
};

const slugify = (value) => String(value)
.toLowerCase()
.normalize("NFD")
.replace(/[\u0300-\u036f]/g, "")
.replace(/[^a-z0-9]+/g, "-")
.replace(/^-+|-+$/g, "")
.slice(0, 54);

const generateValidationId = () => {
const now = new Date();
const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
const nonce = Math.random().toString(36).slice(2, 8).toUpperCase();
return `IPIZ-${stamp}-${nonce}`;
};

const dataUrlToUint8Array = (dataUrl) => {
const base64 = dataUrl.split(",")[1] || "";
const binaryString = atob(base64);
const len = binaryString.length;
const bytes = new Uint8Array(len);
for (let i = 0; i < len; i += 1) {
bytes[i] = binaryString.charCodeAt(i);
}
return bytes;
};

const downloadBlob = (blob, fileName) => {
const url = URL.createObjectURL(blob);
const anchor = document.createElement("a");
anchor.href = url;
anchor.download = fileName;
document.body.appendChild(anchor);
anchor.click();
anchor.remove();
URL.revokeObjectURL(url);
};

const normalizeDocType = (rawType) => {
const value = (rawType || "PDF").toUpperCase().trim();
if (value === "EXCEL") {
return "XLSX";
}
return value;
};

const arrayBufferToBase64 = (buffer) => {
const bytes = new Uint8Array(buffer);
let binary = "";
bytes.forEach((byte) => {
binary += String.fromCharCode(byte);
});
return btoa(binary);
};

const toBase64Url = (base64) => base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

const utf8ToUint8Array = (text) => new TextEncoder().encode(text);

const getDocumentRegistry = () => {
const raw = localStorage.getItem(docRegistryKey);
if (!raw) {
return [];
}
try {
const parsed = JSON.parse(raw);
return Array.isArray(parsed) ? parsed : [];
} catch {
return [];
}
};

const saveDocumentRegistry = (entries) => {
localStorage.setItem(docRegistryKey, JSON.stringify(entries));
};

const registerDocument = (entry) => {
const entries = getDocumentRegistry();
entries.unshift(entry);
saveDocumentRegistry(entries.slice(0, 500));
};

const findDocumentByValidationId = (validationId) => {
if (!validationId) {
return null;
}
const normalized = validationId.trim().toUpperCase();
return getDocumentRegistry().find((item) => String(item.validationId || "").toUpperCase() === normalized) || null;
};

const getOrCreateAuditKeyPair = async () => {
const stored = localStorage.getItem(auditKeyPairStorageKey);
if (stored) {
try {
const parsed = JSON.parse(stored);
const privateKey = await crypto.subtle.importKey(
"pkcs8",
Uint8Array.from(atob(parsed.privateKey), (ch) => ch.charCodeAt(0)),
{ name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
true,
["sign"]
);
const publicKey = await crypto.subtle.importKey(
"spki",
Uint8Array.from(atob(parsed.publicKey), (ch) => ch.charCodeAt(0)),
{ name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
true,
["verify"]
);
return { privateKey, publicKey, fingerprint: parsed.fingerprint || "N/A" };
} catch {
localStorage.removeItem(auditKeyPairStorageKey);
}
}

const keyPair = await crypto.subtle.generateKey(
{
name: "RSASSA-PKCS1-v1_5",
modulusLength: 2048,
publicExponent: new Uint8Array([1, 0, 1]),
hash: "SHA-256"
},
true,
["sign", "verify"]
);

const exportedPrivate = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
const exportedPublic = await crypto.subtle.exportKey("spki", keyPair.publicKey);
const digest = await crypto.subtle.digest("SHA-256", exportedPublic);
const fingerprint = toBase64Url(arrayBufferToBase64(digest)).slice(0, 32);

localStorage.setItem(auditKeyPairStorageKey, JSON.stringify({
privateKey: arrayBufferToBase64(exportedPrivate),
publicKey: arrayBufferToBase64(exportedPublic),
fingerprint
}));

return { privateKey: keyPair.privateKey, publicKey: keyPair.publicKey, fingerprint };
};

const createAuditSignature = async (payload) => {
if (!(window.crypto && window.crypto.subtle)) {
throw new Error("Web Crypto indisponivel neste navegador");
}

const keyPair = await getOrCreateAuditKeyPair();
const payloadString = JSON.stringify(payload);
const payloadBytes = utf8ToUint8Array(payloadString);
const digestBuffer = await crypto.subtle.digest("SHA-256", payloadBytes);
const signatureBuffer = await crypto.subtle.sign(
{ name: "RSASSA-PKCS1-v1_5" },
keyPair.privateKey,
digestBuffer
);

const hash = toBase64Url(arrayBufferToBase64(digestBuffer));
const signature = toBase64Url(arrayBufferToBase64(signatureBuffer));

return {
algorithm: "RSASSA-PKCS1-v1_5/SHA-256",
hash,
signature,
fingerprint: keyPair.fingerprint,
signedAt: new Date().toISOString()
};
};

const ensureQrLibrary = async () => {
await loadExternalScript(
"https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js",
() => Boolean(window.QRCode && window.QRCode.toDataURL)
);
};

const createValidationQrDataUrl = async (validationPayload) => {
await ensureQrLibrary();
return window.QRCode.toDataURL(validationPayload, {
width: 220,
margin: 1,
color: {
dark: "#0A6C85",
light: "#FFFFFF"
}
});
};

const ensureGeneratorLibrary = async (type) => {
if (type === "PDF") {
await loadExternalScript(
"https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js",
() => Boolean(window.jspdf && window.jspdf.jsPDF)
);
return;
}

if (type === "DOCX") {
await loadExternalScript(
"https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js",
() => Boolean(window.docx && window.docx.Document)
);
return;
}

if (type === "XLSX") {
await loadExternalScript(
"https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js",
() => Boolean(window.ExcelJS && window.ExcelJS.Workbook)
);
}
};

const generatePdfDocument = async (doc, validationId, logoDataUrl, qrDataUrl, auditSignature) => {
const { jsPDF } = window.jspdf;
const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
const dateText = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

pdf.setFillColor(247, 250, 252);
pdf.roundedRect(36, 36, 523, 770, 14, 14, "F");
pdf.addImage(logoDataUrl, "PNG", 56, 56, 64, 64);

pdf.setTextColor(10, 108, 133);
pdf.setFontSize(19);
pdf.setFont("helvetica", "bold");
pdf.text("GIVA IPIZ", 132, 80);
pdf.setTextColor(71, 84, 103);
pdf.setFontSize(10.5);
pdf.setFont("helvetica", "normal");
pdf.text("Instituto Politecnico Industrial do Zango", 132, 98);
pdf.text("Documento oficial de monitoria e validacao", 132, 113);

pdf.setTextColor(16, 24, 40);
pdf.setFontSize(11);
pdf.text(`Data de emissao: ${dateText}`, 410, 80);
pdf.text(`Tipo: ${doc.type}`, 410, 98);
pdf.line(56, 132, 540, 132);

pdf.setFont("helvetica", "bold");
pdf.setFontSize(17);
pdf.text(doc.title, 56, 166);
pdf.setFont("helvetica", "normal");
pdf.setTextColor(71, 84, 103);
pdf.setFontSize(11);
pdf.text("Documento gerado automaticamente pela plataforma digital do IPIZ.", 56, 186);

const rows = [
["Escopo", doc.scope],
["Entidade", doc.target],
["Responsavel", doc.responsible],
["Estado", doc.status]
];

let y = 226;
rows.forEach(([k, v]) => {
pdf.setFillColor(255, 255, 255);
pdf.roundedRect(56, y - 16, 484, 34, 7, 7, "F");
pdf.setTextColor(16, 24, 40);
pdf.setFont("helvetica", "bold");
pdf.text(`${k}:`, 70, y + 5);
pdf.setFont("helvetica", "normal");
pdf.setTextColor(71, 84, 103);
pdf.text(String(v), 170, y + 5);
y += 50;
});

pdf.setFillColor(240, 248, 251);
pdf.roundedRect(56, y - 10, 484, 170, 8, 8, "F");
pdf.setTextColor(51, 65, 85);
pdf.setFontSize(10);
pdf.text("Validacao: utilize o ID abaixo para verificacao institucional quando necessario.", 66, y + 14);
pdf.setFont("helvetica", "bold");
pdf.text(`ID Validacao: ${validationId}`, 66, y + 38);
pdf.setFont("helvetica", "normal");
pdf.text(`Hash auditoria: ${auditSignature.hash.slice(0, 38)}...`, 66, y + 58);
pdf.text(`Assinado em: ${new Date(auditSignature.signedAt).toLocaleString("pt-BR")}`, 66, y + 76);
pdf.text(`Chave auditoria: ${auditSignature.fingerprint}`, 66, y + 94);
pdf.addImage(qrDataUrl, "PNG", 446, y + 8, 84, 84);
pdf.setFontSize(8.5);
pdf.text("QR de validacao", 462, y + 104);

pdf.setProperties({
title: doc.title,
subject: `Documento IPIZ ${validationId}`,
author: "GIVA IPIZ",
creator: "Plataforma IPIZ",
keywords: `ipiz,validacao,${validationId},assinatura`
});

pdf.save(`${slugify(doc.title)}-${validationId}.pdf`);
};

const generateDocxDocument = async (doc, validationId, logoDataUrl, qrDataUrl, auditSignature) => {
const {
Document,
Packer,
Paragraph,
TextRun,
HeadingLevel,
AlignmentType,
ImageRun,
Table,
TableRow,
TableCell,
WidthType,
BorderStyle
} = window.docx;

const dateText = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
const logoData = dataUrlToUint8Array(logoDataUrl);
const qrData = dataUrlToUint8Array(qrDataUrl);

const docxDocument = new Document({
sections: [{
children: [
new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ data: logoData, transformation: { width: 90, height: 90 } })] }),
new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "GIVA IPIZ", bold: true, size: 36, color: "0A6C85" })] }),
new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Instituto Politecnico Industrial do Zango", size: 22, color: "475467" })] }),
new Paragraph({ text: "" }),
new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: doc.title, color: "101828" })] }),
new Paragraph({ children: [new TextRun({ text: `Data de emissao: ${dateText}`, color: "475467" })] }),
new Paragraph({ text: "" }),
new Table({
width: { size: 100, type: WidthType.PERCENTAGE },
rows: [
["Escopo", doc.scope],
["Entidade", doc.target],
["Tipo", doc.type],
["Responsavel", doc.responsible],
["Estado", doc.status]
].map(([label, value]) => new TableRow({
children: [
new TableCell({
borders: {
top: { style: BorderStyle.SINGLE, size: 1, color: "D0D5DD" },
bottom: { style: BorderStyle.SINGLE, size: 1, color: "D0D5DD" },
left: { style: BorderStyle.SINGLE, size: 1, color: "D0D5DD" },
right: { style: BorderStyle.SINGLE, size: 1, color: "D0D5DD" }
},
children: [new Paragraph({ children: [new TextRun({ text: String(label), bold: true })] })]
}),
new TableCell({
borders: {
top: { style: BorderStyle.SINGLE, size: 1, color: "D0D5DD" },
bottom: { style: BorderStyle.SINGLE, size: 1, color: "D0D5DD" },
left: { style: BorderStyle.SINGLE, size: 1, color: "D0D5DD" },
right: { style: BorderStyle.SINGLE, size: 1, color: "D0D5DD" }
},
children: [new Paragraph(String(value))]
})
]
}))
}),
new Paragraph({ text: "" }),
new Paragraph({ children: [new TextRun({ text: "Validacao institucional", bold: true, color: "0A6C85" })] }),
new Paragraph({ children: [new TextRun({ text: `ID discreto de verificacao: ${validationId}`, color: "344054" })] }),
new Paragraph({ children: [new TextRun({ text: `Hash de auditoria: ${auditSignature.hash}`, color: "344054" })] }),
new Paragraph({ children: [new TextRun({ text: `Assinado em: ${new Date(auditSignature.signedAt).toLocaleString("pt-BR")}`, color: "344054" })] }),
new Paragraph({ children: [new TextRun({ text: `Chave auditoria: ${auditSignature.fingerprint}`, color: "344054" })] }),
new Paragraph({ text: "" }),
new Paragraph({ alignment: AlignmentType.LEFT, children: [new ImageRun({ data: qrData, transformation: { width: 95, height: 95 } })] }),
new Paragraph({ children: [new TextRun({ text: "QR de validacao do documento", color: "475467" })] })
]
}]
});

const blob = await Packer.toBlob(docxDocument);
downloadBlob(blob, `${slugify(doc.title)}-${validationId}.docx`);
};

const generateXlsxDocument = async (doc, validationId, logoDataUrl, qrDataUrl, auditSignature) => {
const workbook = new window.ExcelJS.Workbook();
const worksheet = workbook.addWorksheet("Relatorio IPIZ");
const dateText = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

worksheet.columns = [{ width: 30 }, { width: 60 }];

const imageId = workbook.addImage({ base64: logoDataUrl, extension: "png" });
worksheet.addImage(imageId, "A1:B4");

const qrImageId = workbook.addImage({ base64: qrDataUrl, extension: "png" });
worksheet.addImage(qrImageId, "D1:E5");

worksheet.mergeCells("A5:B5");
worksheet.getCell("A5").value = "GIVA IPIZ";
worksheet.getCell("A5").font = { size: 18, bold: true, color: { argb: "FF0A6C85" } };

worksheet.mergeCells("A6:B6");
worksheet.getCell("A6").value = "Instituto Politecnico Industrial do Zango";
worksheet.getCell("A6").font = { size: 11, color: { argb: "FF475467" } };

worksheet.mergeCells("A8:B8");
worksheet.getCell("A8").value = doc.title;
worksheet.getCell("A8").font = { size: 14, bold: true, color: { argb: "FF101828" } };

const rows = [
["Escopo", doc.scope],
["Entidade", doc.target],
["Tipo", doc.type],
["Responsavel", doc.responsible],
["Estado", doc.status],
["Data de emissao", dateText],
["ID Validacao", validationId],
["Hash Auditoria", auditSignature.hash],
["Assinado em", new Date(auditSignature.signedAt).toLocaleString("pt-BR")],
["Chave Auditoria", auditSignature.fingerprint],
["QR", "Leia o QR no topo da planilha para validar"]
];

rows.forEach((row, index) => {
const rowNum = 10 + index;
worksheet.getCell(`A${rowNum}`).value = row[0];
worksheet.getCell(`B${rowNum}`).value = row[1];
worksheet.getCell(`A${rowNum}`).font = { bold: true, color: { argb: "FF344054" } };
worksheet.getCell(`B${rowNum}`).font = { color: { argb: "FF475467" } };
worksheet.getCell(`A${rowNum}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF7FAFC" } };
});

const buffer = await workbook.xlsx.writeBuffer();
const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
downloadBlob(blob, `${slugify(doc.title)}-${validationId}.xlsx`);
};

const setupDocumentDownloads = () => {
document.querySelectorAll("button[data-download-doc]").forEach((button) => {
button.addEventListener("click", async () => {
setButtonLoading(button, true, "A gerar...");
try {
const validationId = generateValidationId();
const doc = {
title: button.dataset.docTitle || "Relatorio IPIZ",
type: normalizeDocType(button.dataset.docType || "PDF"),
scope: button.dataset.docScope || "Documento",
target: button.dataset.docTarget || "Entidade",
status: button.dataset.docStatus || "Em conformidade",
responsible: button.dataset.docResponsible || "Coordenacao IPIZ"
};

if (!["PDF", "DOCX", "XLSX"].includes(doc.type)) {
throw new Error("Formato nao suportado");
}

const logoSrc = await getLogoDataUrl();
if (!logoSrc) {
throw new Error("Logo oficial indisponivel");
}

const validationPayload = JSON.stringify({
id: validationId,
title: doc.title,
type: doc.type,
scope: doc.scope,
target: doc.target,
issuedAt: new Date().toISOString()
});

const qrDataUrl = await createValidationQrDataUrl(validationPayload);
const auditSignature = await createAuditSignature({
validationId,
title: doc.title,
type: doc.type,
scope: doc.scope,
target: doc.target,
status: doc.status,
responsible: doc.responsible,
issuedAt: new Date().toISOString()
});

await ensureGeneratorLibrary(doc.type);

if (doc.type === "PDF") {
await generatePdfDocument(doc, validationId, logoSrc, qrDataUrl, auditSignature);
} else if (doc.type === "DOCX") {
await generateDocxDocument(doc, validationId, logoSrc, qrDataUrl, auditSignature);
} else {
await generateXlsxDocument(doc, validationId, logoSrc, qrDataUrl, auditSignature);
}

registerDocument({
validationId,
title: doc.title,
type: doc.type,
scope: doc.scope,
target: doc.target,
status: doc.status,
responsible: doc.responsible,
issuedAt: new Date().toISOString(),
audit: {
algorithm: auditSignature.algorithm,
hash: auditSignature.hash,
signature: auditSignature.signature,
fingerprint: auditSignature.fingerprint,
signedAt: auditSignature.signedAt
}
});

showToast(`Download concluido (${doc.type})  ID ${validationId}.`, "success", "download_done");
} catch {
showToast("Falha ao gerar no formato solicitado. Tente novamente.", "danger", "error");
} finally {
setButtonLoading(button, false);
}
});
});
};

const setupDocumentValidationModule = () => {
const form = document.getElementById("document-validation-form");
const input = document.getElementById("document-validation-id");
const result = document.getElementById("document-validation-result");

if (!form || !input || !result) {
return;
}

form.addEventListener("submit", (event) => {
event.preventDefault();
const rawValue = (input.value || "").trim();
if (!rawValue) {
result.className = "validation-result validation-result-warning";
result.innerHTML = "Informe um ID para validar.";
return;
}

const found = findDocumentByValidationId(rawValue);
if (!found) {
result.className = "validation-result validation-result-error";
result.innerHTML = `ID <strong>${rawValue.toUpperCase()}</strong> nao encontrado no registo local de auditoria.`;
showToast("ID nao encontrado no registo local.", "warn", "warning");
return;
}

result.className = "validation-result validation-result-success";
result.innerHTML = `
<strong>Documento valido</strong><br>
ID: ${found.validationId}<br>
Titulo: ${found.title}<br>
Tipo: ${found.type}<br>
Escopo: ${found.scope}<br>
Entidade: ${found.target}<br>
Emitido em: ${new Date(found.issuedAt).toLocaleString("pt-BR")}<br>
Assinatura: ${found.audit?.algorithm || "N/A"}<br>
Hash: ${(found.audit?.hash || "").slice(0, 38)}...
`;
showToast("Documento validado com sucesso.", "success", "verified");
});
};

const setupUxFeedback = () => {
if (route === "login.html") {
return;
}

const passiveButtons = document.querySelectorAll("button.btn[type='button']:not([data-action='read']):not(#mark-all-read):not([data-download-doc])");
passiveButtons.forEach((button) => {
button.addEventListener("click", () => {
setButtonLoading(button, true);
const label = (button.textContent || "").trim().toLowerCase();

setTimeout(() => {
setButtonLoading(button, false);
if (label.includes("contato")) {
showModal("Contato do parceiro", "A janela de contacto sera integrada com email e WhatsApp empresarial.", "info", "call");
return;
}

if (label.includes("pipeline")) {
showModal("Pipeline carregado", "Detalhes operacionais do parceiro estao a ser preparados para a proxima versao.", "success", "hub");
return;
}

if (label.includes("upload") || label.includes("importar")) {
showModal("Gestao documental", "O modulo de upload real sera ativado com armazenamento seguro no backend.", "warn", "upload_file");
return;
}

if (label.includes("seguranca") || label.includes("acessos")) {
showModal("Configuracoes de seguranca", "As alteracoes serao aplicadas assim que a API de identidade for integrada.", "warn", "admin_panel_settings");
return;
}

if (label.includes("cancelar")) {
showToast("Edicao cancelada", "info", "undo");
return;
}

showToast("Acao recebida. Em breve com integracao completa.", "info", "bolt");
}, 520);
});
});

document.querySelectorAll("a[href='#']:not(.logout-link)").forEach((link) => {
link.addEventListener("click", (event) => {
event.preventDefault();
showToast("Funcionalidade em preparacao.", "info", "construction");
});
});

document.querySelectorAll("button[data-action='read']").forEach((button) => {
button.addEventListener("click", () => {
setButtonLoading(button, true, "A atualizar...");
setTimeout(() => {
setButtonLoading(button, false);
showToast("Estado da notificacao atualizado.", "success", "task_alt");
}, 280);
});
});

const markAllRead = document.getElementById("mark-all-read");
if (markAllRead) {
markAllRead.addEventListener("click", () => {
setButtonLoading(markAllRead, true, "A atualizar...");
setTimeout(() => {
setButtonLoading(markAllRead, false);
showToast("Todas as notificacoes foram marcadas como lidas.", "success", "done_all");
}, 420);
});
}
};

if (route === "login.html") {
const currentTheme = localStorage.getItem("ipiz-theme") || "light";
applyTheme(currentTheme);
setupLogin();
if (themeBtn) {
themeBtn.addEventListener("click", () => {
const nextTheme = html.getAttribute("data-theme") === "dark" ? "light" : "dark";
applyTheme(nextTheme);
});
}
return;
}

const session = enforceRouteProtection();
if (!session) {
return;
}

const currentTheme = localStorage.getItem("ipiz-theme") || "light";
applyTheme(currentTheme);
applyUserContext(session);
setupLogout();
setActiveNav();
setupSearch();
setupNotifications();
setupSettingsForm();
setupDocumentDownloads();
setupDocumentValidationModule();
setupUxFeedback();

if (menuBtn) {
menuBtn.addEventListener("click", openSidebar);
}

if (closeBtn) {
closeBtn.addEventListener("click", closeSidebar);
}

if (backdrop) {
backdrop.addEventListener("click", closeSidebar);
}

if (themeBtn) {
themeBtn.addEventListener("click", () => {
const nextTheme = html.getAttribute("data-theme") === "dark" ? "light" : "dark";
applyTheme(nextTheme);
});
}
})();
