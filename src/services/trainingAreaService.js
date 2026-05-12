import { supabase } from "../lib/supabase.js";

const CACHE_TTL_MS = 5 * 60 * 1000;
const queryCache = new Map();

function getCached(key) {
  const hit = queryCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    queryCache.delete(key);
    return null;
  }
  return hit.value;
}

function setCached(key, value) {
  queryCache.set(key, { at: Date.now(), value });
}

function clearCacheByPrefix(prefix) {
  for (const key of queryCache.keys()) {
    if (key.startsWith(prefix)) {
      queryCache.delete(key);
    }
  }
}

export function canUseTrainingAreaApi() {
  return typeof supabase !== "undefined" && supabase !== null;
}

/**
 * Listar todas as áreas de formação ativas
 */
export async function listTrainingAreas() {
  if (!canUseTrainingAreaApi()) return [];

  const cacheKey = "training_areas:active";
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const { data, error } = await supabase
    .from("training_area")
    .select("*")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) {
    console.error("[trainingAreaService] listTrainingAreas error:", error);
    return [];
  }
  const rows = data || [];
  setCached(cacheKey, rows);
  return rows;
}

export async function updateTrainingArea(areaId, payload) {
  if (!canUseTrainingAreaApi() || !areaId) return null;

  const { data, error } = await supabase
    .from("training_area")
    .update(payload)
    .eq("id", areaId)
    .select()
    .single();

  if (error) {
    console.error("[trainingAreaService] updateTrainingArea error:", error);
    return null;
  }

  clearCacheByPrefix("training_areas:");
  clearCacheByPrefix("courses:");

  return data;
}

/**
 * Obter uma área de formação por ID
 */
export async function getTrainingArea(areaId) {
  if (!canUseTrainingAreaApi()) return null;

  const { data, error } = await supabase
    .from("training_area")
    .select("*")
    .eq("id", areaId)
    .single();

  if (error) {
    console.error("[trainingAreaService] getTrainingArea error:", error);
    return null;
  }
  return data;
}

/**
 * Criar nova área (Admin)
 */
export async function createTrainingArea(payload) {
  if (!canUseTrainingAreaApi()) return null;

  const { data, error } = await supabase
    .from("training_area")
    .insert([payload])
    .select()
    .single();

  if (error) {
    console.error("[trainingAreaService] createTrainingArea error:", error);
    return null;
  }
  clearCacheByPrefix("training_areas:");
  return data;
}

/**
 * Listar cursos de uma área
 */
export async function listCoursesByArea(areaId, options = {}) {
  if (!canUseTrainingAreaApi()) return [];

  const includeInactive = Boolean(options.includeInactive);
  const cacheKey = `courses:${String(areaId)}:${includeInactive ? "all" : "active"}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  let query = supabase
    .from("courses")
    .select("*")
    .eq("training_area_id", areaId)
    .order("name", { ascending: true });

  if (!includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[trainingAreaService] listCoursesByArea error:", error);
    return [];
  }
  const rows = data || [];
  setCached(cacheKey, rows);
  return rows;
}

/**
 * Criar novo curso para uma área
 */
export async function createCourse(areaId, courseData) {
  if (!canUseTrainingAreaApi()) return null;

  const { data, error } = await supabase
    .from("courses")
    .insert([{ ...courseData, training_area_id: areaId }])
    .select()
    .single();

  if (error) {
    console.error("[trainingAreaService] createCourse error:", error);
    return null;
  }
  clearCacheByPrefix("courses:");
  return data;
}

export async function updateCourse(courseId, payload) {
  if (!canUseTrainingAreaApi() || !courseId) return null;

  const { data, error } = await supabase
    .from("courses")
    .update(payload)
    .eq("id", courseId)
    .select()
    .single();

  if (error) {
    console.error("[trainingAreaService] updateCourse error:", error);
    return null;
  }

  clearCacheByPrefix("courses:");

  return data;
}
