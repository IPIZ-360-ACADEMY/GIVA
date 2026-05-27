export function toLocalIsoDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseSchoolYear(value) {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(\d{4})\s*\/\s*(\d{4})$/);
  if (!match) return null;

  const startYear = Number(match[1]);
  const endYear = Number(match[2]);
  if (!Number.isFinite(startYear) || !Number.isFinite(endYear)) return null;
  if (endYear !== startYear + 1) return null;

  return { startYear, endYear };
}

export function isPastSchoolYear(value) {
  const parsed = parseSchoolYear(value);
  if (!parsed) return false;
  return parsed.startYear < new Date().getFullYear();
}
