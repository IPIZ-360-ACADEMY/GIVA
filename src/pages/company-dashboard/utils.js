export function getPendingDays(appliedAt) {
  if (!appliedAt) return 0;
  const started = new Date(appliedAt).getTime();
  if (!Number.isFinite(started)) return 0;
  const diffMs = Date.now() - started;
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export function parseSafeDate(value) {
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

export function getSlaMeta(days) {
  if (days >= 6) {
    return { label: "SLA crítico", color: "#b91c1c", background: "#fee2e2" };
  }
  if (days >= 3) {
    return { label: "SLA atenção", color: "#92400e", background: "#fef3c7" };
  }
  return { label: "Dentro do SLA", color: "#166534", background: "#dcfce7" };
}

export function getInternPhaseMeta(referenceDate) {
  const days = getPendingDays(referenceDate);
  if (days > 120) {
    return { label: "Potencial contratual", tone: "contract", days };
  }
  if (days > 30) {
    return { label: "Estágio em desenvolvimento", tone: "active", days };
  }
  return { label: "Fase de integração", tone: "onboarding", days };
}

export function resolveInternAreaName(app) {
  return (
    app.student?.training_area?.name ||
    app.student?.area_name ||
    app.student?.course?.training_area?.name ||
    "Sem área definida"
  );
}

export function resolveInternSectorName(app) {
  const vacancyTitle = String(app.vacancy?.title ?? "").trim();
  if (!vacancyTitle) return "Setor geral";

  const splitByDash = vacancyTitle
    .split(/[\-–—|/]/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (splitByDash.length > 1) return splitByDash[0];

  const words = vacancyTitle.split(/\s+/).filter(Boolean);
  return words.length > 2 ? words.slice(0, 2).join(" ") : vacancyTitle;
}
