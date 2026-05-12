/**
 * Configura as tabs e permissões de cada visão do painel de avaliações
 * com base no perfil de acesso (accessProfile).
 *
 * Retorna um objeto { viewMode, tabs, defaultTab, canCreate, canExport, canApprove }
 */
export function resolveEvaluationView(accessProfile) {
  if (!accessProfile) {
    return buildView("student", [{ id: "mine", label: "Minhas Avaliações" }], "mine");
  }

  const {
    isSuperAdmin,
    isAdminCore,
    isCoordinatorUser,
    isTeacherUser,
    isStudentUser,
    isCompanyUser,
  } = accessProfile;

  if (isSuperAdmin || isAdminCore) {
    return buildView(
      "admin",
      [
        { id: "overview", label: "Visão Geral" },
        { id: "by-area", label: "Por Área" },
        { id: "by-class", label: "Por Turma" },
        { id: "by-student", label: "Por Aluno" },
        { id: "export", label: "Exportar" },
      ],
      "overview",
      { canCreate: true, canExport: true, canApprove: true },
    );
  }

  if (isCoordinatorUser) {
    return buildView(
      "coordinator",
      [
        { id: "area-overview", label: "Minha Área" },
        { id: "by-class", label: "Por Turma" },
        { id: "by-student", label: "Por Aluno" },
        { id: "export", label: "Relatórios" },
      ],
      "area-overview",
      { canCreate: false, canExport: true, canApprove: true },
    );
  }

  if (isTeacherUser) {
    return buildView(
      "teacher",
      [
        { id: "my-classes", label: "Minhas Turmas" },
        { id: "grade-entry", label: "Lançar Nota" },
        { id: "student-progress", label: "Progresso" },
      ],
      "my-classes",
      { canCreate: true, canExport: true, canApprove: false },
    );
  }

  if (isStudentUser) {
    return buildView(
      "student",
      [
        { id: "mine", label: "Minhas Avaliações" },
        { id: "history", label: "Histórico" },
      ],
      "mine",
      { canCreate: false, canExport: false, canApprove: false },
    );
  }

  if (isCompanyUser) {
    return buildView(
      "company",
      [
        { id: "intern-evals", label: "Avaliações de Estágio" },
        { id: "history", label: "Histórico" },
      ],
      "intern-evals",
      { canCreate: false, canExport: false, canApprove: false },
    );
  }

  // EXTERNAL / fallback — leitura mínima
  return buildView(
    "external",
    [{ id: "mine", label: "Minhas Avaliações" }],
    "mine",
  );
}

function buildView(viewMode, tabs, defaultTab, perms = {}) {
  return {
    viewMode,
    tabs,
    defaultTab,
    canCreate: perms.canCreate ?? false,
    canExport: perms.canExport ?? false,
    canApprove: perms.canApprove ?? false,
  };
}
