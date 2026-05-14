import { isSupabaseConfigured, supabase } from "../lib/supabase.js";

const TABLE = "manual_classes";
const STORAGE_KEY = "giva.classes.registry";
const STORAGE_TTL_MS = 24 * 60 * 60 * 1000;
const STORAGE_MAX_ITEMS = 500;
const isTestMode = import.meta.env.MODE === "test";
let memoryCache = null;
let memoryCacheAt = 0;

function canUseClassesApi() {
  return !isTestMode && isSupabaseConfigured && Boolean(supabase);
}

function normalizeRow(row) {
  return {
    id: row.id,
    anoLetivo: row.ano_letivo ?? row.anoLetivo ?? "",
    curso: row.curso ?? "",
    turma: row.turma ?? "",
    supervisor: row.supervisor ?? "",
    total: Number(row.total ?? 0),
    ativos: Number(row.ativos ?? 0),
    monitoramento: Number(row.monitoramento ?? 0),
    risco: Number(row.risco ?? 0),
    mediaNota: String(row.media_nota ?? row.mediaNota ?? "0.0"),
    areaId: row.area_id ?? row.areaId ?? null,
  };
}

function readFromStorage() {
  if (memoryCache && Date.now() - memoryCacheAt <= STORAGE_TTL_MS) {
    return memoryCache;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      const legacyItems = parsed.filter((item) => item && typeof item === "object").slice(0, STORAGE_MAX_ITEMS);
      memoryCache = legacyItems;
      memoryCacheAt = Date.now();
      return legacyItems;
    }

    const savedAt = Number(parsed?.savedAt ?? 0);
    const items = Array.isArray(parsed?.items) ? parsed.items : [];
    if (!savedAt || Date.now() - savedAt > STORAGE_TTL_MS) {
      localStorage.removeItem(STORAGE_KEY);
      memoryCache = [];
      memoryCacheAt = Date.now();
      return [];
    }

    const safeItems = items.filter((item) => item && typeof item === "object").slice(0, STORAGE_MAX_ITEMS);
    memoryCache = safeItems;
    memoryCacheAt = Date.now();
    return safeItems;
  } catch {
    memoryCache = [];
    memoryCacheAt = Date.now();
    return [];
  }
}

function writeToStorage(items) {
  const safeItems = Array.isArray(items)
    ? items.filter((item) => item && typeof item === "object").slice(0, STORAGE_MAX_ITEMS)
    : [];

  memoryCache = safeItems;
  memoryCacheAt = Date.now();

  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        savedAt: Date.now(),
        items: safeItems,
      })
    );
  } catch {
    // storage full or unavailable — silently ignore
  }
}

export async function listManualClasses() {
  if (isTestMode) {
    return readFromStorage();
  }

  if (!canUseClassesApi()) {
    throw new Error("Supabase is not configured");
  }

  if (canUseClassesApi()) {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    const rows = (data ?? []).map(normalizeRow).slice(0, STORAGE_MAX_ITEMS);
    writeToStorage(rows);
    return rows;
  }

  return [];
}

export async function createManualClass(payload) {
  if (isTestMode) {
    const next = { ...payload, id: `manual-${Date.now()}` };
    const current = readFromStorage();
    writeToStorage([next, ...current]);
    return next;
  }

  if (!canUseClassesApi()) {
    throw new Error("Supabase is not configured");
  }

  if (canUseClassesApi()) {
    const { data, error } = await supabase
      .from(TABLE)
      .insert([
        {
          ano_letivo: payload.anoLetivo,
          curso: payload.curso,
          turma: payload.turma,
          supervisor: payload.supervisor,
          area_id: payload.areaId ?? null,
          total: payload.total ?? 0,
          ativos: payload.ativos ?? 0,
          monitoramento: payload.monitoramento ?? 0,
          risco: payload.risco ?? 0,
          media_nota: payload.mediaNota ?? "0.0",
        },
      ])
      .select()
      .single();

    if (error) {
      throw error;
    }

    return normalizeRow(data);
  }

  throw new Error("Falha ao criar turma manual");
}

export async function deleteManualClass(id) {
  if (isTestMode) {
    const current = readFromStorage();
    writeToStorage(current.filter((item) => item.id !== id));
    return true;
  }

  if (!canUseClassesApi()) {
    throw new Error("Supabase is not configured");
  }

  if (canUseClassesApi()) {
    const { error } = await supabase.from(TABLE).delete().eq("id", id);
    if (error) {
      throw error;
    }
    return true;
  }

  return false;
}
