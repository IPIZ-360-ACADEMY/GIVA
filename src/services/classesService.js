import { isSupabaseConfigured, supabase } from "../lib/supabase.js";

const TABLE = "manual_classes";
const STORAGE_KEY = "giva.classes.registry";
const isTestMode = import.meta.env.MODE === "test";

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
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === "object") : [];
  } catch {
    return [];
  }
}

function writeToStorage(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // storage full or unavailable — silently ignore
  }
}

export async function listManualClasses() {
  if (canUseClassesApi()) {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("created_at", { ascending: false });

    if (!error) {
      return (data ?? []).map(normalizeRow);
    }
    // fall through to localStorage on error
  }

  return readFromStorage();
}

export async function createManualClass(payload) {
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

    if (!error && data) {
      return normalizeRow(data);
    }
    // fall through to localStorage on error
  }

  const next = { ...payload, id: `manual-${Date.now()}` };
  const current = readFromStorage();
  writeToStorage([next, ...current]);
  return next;
}

export async function deleteManualClass(id) {
  if (canUseClassesApi()) {
    const { error } = await supabase.from(TABLE).delete().eq("id", id);
    if (!error) return true;
  }

  const current = readFromStorage();
  writeToStorage(current.filter((item) => item.id !== id));
  return true;
}
