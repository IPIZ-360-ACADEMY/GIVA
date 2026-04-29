import { isSupabaseConfigured, supabase } from "../lib/supabase.js";

const VACANCIES_TABLE = "partner_vacancies";

function normalizeVacancy(row) {
  const totalSlots = Number(row?.total_slots ?? 0) || 0;
  const filledSlots = Number(row?.filled_slots ?? 0) || 0;
  const availableSlots = Math.max(0, totalSlots - filledSlots);

  return {
    id: row.id,
    partner_id: row.partner_id,
    title: row.title ?? "",
    description: row.description ?? "",
    requirements: row.requirements ?? "",
    location: row.location ?? "",
    status: row.status ?? "OPEN",
    total_slots: totalSlots,
    filled_slots: filledSlots,
    available_slots: availableSlots,
    created_by: row.created_by ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

export function canUseVacanciesApi() {
  return isSupabaseConfigured && Boolean(supabase);
}

export async function listOpenVacancies() {
  if (!canUseVacanciesApi()) return [];

  const { data, error } = await supabase
    .from(VACANCIES_TABLE)
    .select("*")
    .eq("status", "OPEN")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[vacanciesService] listOpenVacancies error:", error);
    return [];
  }

  return (data ?? []).map(normalizeVacancy);
}

export async function listPartnerVacancies(partnerId, options = {}) {
  if (!canUseVacanciesApi() || !partnerId) return [];

  const includeClosed = Boolean(options.includeClosed);

  let query = supabase
    .from(VACANCIES_TABLE)
    .select("*")
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false });

  if (!includeClosed) {
    query = query.eq("status", "OPEN");
  }

  const { data, error } = await query;

  if (error) {
    console.error("[vacanciesService] listPartnerVacancies error:", error);
    return [];
  }

  return (data ?? []).map(normalizeVacancy);
}

export async function createPartnerVacancy(payload) {
  if (!canUseVacanciesApi()) {
    throw new Error("Supabase is not configured");
  }

  const totalSlots = Math.max(1, Number(payload?.total_slots ?? 1) || 1);

  const record = {
    partner_id: payload.partner_id,
    title: String(payload?.title ?? "").trim(),
    description: String(payload?.description ?? "").trim(),
    requirements: String(payload?.requirements ?? "").trim(),
    location: String(payload?.location ?? "").trim(),
    total_slots: totalSlots,
    filled_slots: 0,
    status: "OPEN",
  };

  const { data, error } = await supabase
    .from(VACANCIES_TABLE)
    .insert(record)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return normalizeVacancy(data);
}

export async function closePartnerVacancy(vacancyId) {
  return updatePartnerVacancyStatus(vacancyId, "CLOSED");
}

export async function reopenPartnerVacancy(vacancyId) {
  return updatePartnerVacancyStatus(vacancyId, "OPEN");
}

export async function updatePartnerVacancyStatus(vacancyId, status) {
  if (!canUseVacanciesApi()) {
    throw new Error("Supabase is not configured");
  }

  if (!vacancyId) {
    throw new Error("vacancyId is required");
  }

  const normalizedStatus = String(status ?? "").toUpperCase();
  if (!["OPEN", "CLOSED"].includes(normalizedStatus)) {
    throw new Error("invalid vacancy status");
  }

  const { data, error } = await supabase
    .from(VACANCIES_TABLE)
    .update({ status: normalizedStatus })
    .eq("id", vacancyId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return normalizeVacancy(data);
}
