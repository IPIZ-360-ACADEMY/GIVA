import { isCoordinatorRole } from "./accessControl.js";

function normalizeCourseCodes(codes) {
  if (!Array.isArray(codes)) return [];
  const unique = new Set();
  for (const code of codes) {
    const normalized = String(code ?? "").trim().toUpperCase();
    if (normalized) {
      unique.add(normalized);
    }
  }
  return Array.from(unique);
}

function normalizeCourseIds(ids) {
  if (!Array.isArray(ids)) return [];
  const unique = new Set();
  for (const id of ids) {
    const normalized = String(id ?? "").trim();
    if (normalized) {
      unique.add(normalized);
    }
  }
  return Array.from(unique);
}

function readValueByKeys(row, keys = []) {
  for (const key of keys) {
    if (row?.[key] != null && row[key] !== "") {
      return row[key];
    }
  }
  return null;
}

export function getCoordinatorScope(authProfile) {
  return {
    role: String(authProfile?.role ?? "").toUpperCase(),
    areaId: authProfile?.areaId ? String(authProfile.areaId) : null,
    courseIds: normalizeCourseIds(authProfile?.courseIds),
    courseCodes: normalizeCourseCodes(authProfile?.courseCodes),
  };
}

export function hasCoordinatorScope(authProfile) {
  const scope = getCoordinatorScope(authProfile);
  return isCoordinatorRole(scope.role) && Boolean(scope.areaId || scope.courseIds.length || scope.courseCodes.length);
}

export function matchesCoordinatorScope(row, authProfile, options = {}) {
  const scope = getCoordinatorScope(authProfile);
  if (!isCoordinatorRole(scope.role)) return true;

  const areaValue = readValueByKeys(row, options.areaKeys ?? ["areaId", "area_id", "training_area_id"]);
  const courseIdValue = readValueByKeys(row, options.courseIdKeys ?? ["courseId", "course_id"]);
  const courseCodeValue = readValueByKeys(row, options.courseCodeKeys ?? ["course", "curso", "course_code"]);

  if (scope.areaId) {
    if (!areaValue) return false;
    if (String(areaValue) !== scope.areaId) return false;
  }

  if (scope.courseIds.length > 0) {
    if (!courseIdValue) return false;
    if (!scope.courseIds.includes(String(courseIdValue))) return false;
  }

  if (scope.courseCodes.length > 0) {
    if (!courseCodeValue) return false;
    const normalizedCode = String(courseCodeValue).trim().toUpperCase();
    if (!scope.courseCodes.includes(normalizedCode)) return false;
  }

  return true;
}

export function filterByCoordinatorScope(rows, authProfile, options = {}) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  return rows.filter((row) => matchesCoordinatorScope(row, authProfile, options));
}
